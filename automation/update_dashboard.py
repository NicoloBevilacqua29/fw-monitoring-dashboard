import os
import re
import subprocess
import sys
from datetime import datetime

import win32com.client


REPO_DIR = r"C:\Users\nicolo.bevilacqua\Desktop\Tools Fastweb\GITHUB_DASH"
DATA_DIR = os.path.join(REPO_DIR, "data")
AUTOMATION_DIR = os.path.join(REPO_DIR, "automation")
LAST_MAIL_FILE = os.path.join(AUTOMATION_DIR, "last_mail.txt")

GIT_EXE = r"C:\Users\nicolo.bevilacqua\AppData\Local\Programs\Git\cmd\git.exe"

MAIL_SUBJECTS = [
    "[External] Informatica WebServiceHub status - as008pwc",
    "[External] Informatica CDC status - as008pwc",
    "[External] DB EDH Monitoring JSON",
    "[External] Report Cluster Informatica (Filtrato)",
]


def run_git(args):
    result = subprocess.run(
        [GIT_EXE] + args,
        cwd=REPO_DIR,
        text=True,
        capture_output=True
    )

    if result.stdout:
        print(result.stdout)

    if result.stderr:
        print(result.stderr)

    return result.returncode


def normalize_json_file(file_path):
    """Corregge eventuali valori JSON malformati prima del salvataggio."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # WS JSON: "http_code": 000 -> "http_code": 0
    content = re.sub(
        r'("http_code"\s*:\s*)0{2,}',
        r'\g<1>0',
        content
    )

    # WS JSON: "elapsed_seconds": ,  -> "elapsed_seconds": null,
    content = re.sub(
        r'("elapsed_seconds"\s*:\s*),',
        r'\1null,',
        content
    )

    filename = os.path.basename(file_path).lower()

    # SOLO report_finale.json deve essere array, perché agents.html legge una lista di agent
    if filename.startswith("report_finale"):
        stripped = content.strip().rstrip("]").strip()

        if stripped.startswith("{"):
            objects = re.split(r'}\s*\n\s*{', stripped)

            if len(objects) > 1:
                content = "[{" + "},{".join(
                    o.strip().strip("{").strip("}") for o in objects
                ) + "}]"
            elif not content.strip().startswith("["):
                content = "[" + content.strip() + "]"

    else:
        # WS / CDC / DB devono restare oggetti singoli.
        # Se per errore sono array con un solo oggetto, li spacchetta.
        stripped = content.strip()

        if stripped.startswith("[") and stripped.endswith("]"):
            import json
            try:
                data = json.loads(stripped)
                if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
                    content = json.dumps(data[0], ensure_ascii=False, indent=2)
            except Exception:
                pass

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")


def is_valid_json(file_path):
    """Ritorna True se il file è un JSON valido."""
    import json
    try:
        with open(file_path, encoding="utf-8") as f:
            json.load(f)
        return True
    except Exception as e:
        print(f"  JSON non valido ({file_path.name}): {e}")
        return False


def get_last_processed_ids():
    if not os.path.exists(LAST_MAIL_FILE):
        return set()

    with open(LAST_MAIL_FILE, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def save_processed_ids(ids):
    with open(LAST_MAIL_FILE, "w", encoding="utf-8") as f:
        for mail_id in sorted(ids):
            f.write(mail_id + "\n")


def download_json_from_outlook():
    os.makedirs(DATA_DIR, exist_ok=True)

    processed_ids = get_last_processed_ids()
    new_processed_ids = set(processed_ids)

    print("Connessione a Outlook...")

    outlook = win32com.client.Dispatch(
        "Outlook.Application"
    ).GetNamespace("MAPI")

    inbox = outlook.GetDefaultFolder(6)
    messages = inbox.Items
    messages.Sort("[ReceivedTime]", True)

    total_saved = 0
    processed_new_mail = False

    for target_subject in MAIL_SUBJECTS:
        print(f"\nCerco mail più recente con oggetto:")
        print(target_subject)

        latest_message = None

        for message in messages:
            try:
                subject = message.Subject or ""

                if subject.strip() == target_subject:
                    latest_message = message
                    break

            except Exception:
                continue

        if latest_message is None:
            print("Nessuna mail trovata.")
            continue

        mail_id = latest_message.EntryID

        if mail_id in processed_ids:
            print("Mail già processata.")
            continue

        print(f"Nuova mail trovata: {latest_message.Subject}")
        print(f"Ricevuta il: {latest_message.ReceivedTime}")

        saved = 0
        attachments = latest_message.Attachments

        for i in range(1, attachments.Count + 1):
            attachment = attachments.Item(i)
            filename = attachment.FileName

            if filename.lower().endswith(".json"):
                from pathlib import Path
                save_path = Path(DATA_DIR) / filename

                # Salva in un tmp, normalizza, valida, poi sposta
                tmp_path = Path(DATA_DIR) / (filename + ".tmp")
                attachment.SaveAsFile(str(tmp_path))
                normalize_json_file(str(tmp_path))

                if not is_valid_json(tmp_path):
                    print(f"  Scartato (JSON non valido): {filename}")
                    tmp_path.unlink(missing_ok=True)
                    continue

                tmp_path.replace(save_path)
                print(f"Salvato e normalizzato: {filename}")

                saved += 1
                total_saved += 1

        if saved == 0:
            print("La mail trovata non contiene allegati JSON.")
            continue

        new_processed_ids.add(mail_id)
        processed_new_mail = True

        try:
            latest_message.Delete()
            print("Mail eliminata (spostata nel Cestino).")
        except Exception as e:
            print(f"  Errore durante l'eliminazione della mail: {e}")

    save_processed_ids(new_processed_ids)

    print(f"\nTotale JSON salvati: {total_saved}")

    return processed_new_mail


def git_has_changes():
    result = subprocess.run(
        [GIT_EXE, "status", "--porcelain", "--", "data"],
        cwd=REPO_DIR,
        text=True,
        capture_output=True
    )

    print("\nControllo modifiche Git:")
    print(result.stdout if result.stdout else "Nessuna modifica rilevata.")

    return bool(result.stdout.strip())


def commit_and_push():
    if not git_has_changes():
        print("Mail processate, ma i JSON sono identici a quelli già pubblicati.")
        return

    print("Aggiungo file JSON a Git...")

    if run_git(["add", "data"]) != 0:
        sys.exit("Errore durante git add.")

    commit_message = (
        "Update monitoring JSON data "
        f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    print("Creo commit...")

    commit_code = run_git([
        "commit",
        "-m",
        commit_message
    ])

    if commit_code != 0:
        print("Nessun commit creato o errore durante il commit.")
        return

    print("Push su GitHub...")

    if run_git(["push"]) != 0:
        sys.exit("Errore durante git push.")

    print("Dashboard aggiornata su GitHub.")


def main():
    if not os.path.exists(GIT_EXE):
        sys.exit(f"Git non trovato qui: {GIT_EXE}")

    has_new_mail = download_json_from_outlook()

    if has_new_mail:
        commit_and_push()
    else:
        print("Fine: nessuna nuova mail da aggiornare.")


if __name__ == "__main__":
    main()