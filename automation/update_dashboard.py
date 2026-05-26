import os
import re
import subprocess
import sys
from datetime import datetime

import win32com.client


REPO_DIR = r"C:\Users\nicolo.bevilacqua\Desktop\Tools Fastweb\GITHUB_DASH"

DATA_DIR = os.path.join(REPO_DIR, "data")

AUTOMATION_DIR = os.path.join(REPO_DIR, "automation")

LAST_MAIL_FILE = os.path.join(
    AUTOMATION_DIR,
    "last_mail.txt"
)

GIT_EXE = r"C:\Users\nicolo.bevilacqua\AppData\Local\Programs\Git\cmd\git.exe"

TARGET_SUBJECT = "[External] Informatica WebServiceHub status - as008pwc"


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

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Corregge:
    # "http_code": 000
    # -> "http_code": 0

    content = re.sub(
        r'("http_code"\s*:\s*)0{2,}',
        r'\g<1>0',
        content
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def download_json_from_latest_mail():

    os.makedirs(DATA_DIR, exist_ok=True)

    print("Connessione a Outlook...")

    outlook = win32com.client.Dispatch(
        "Outlook.Application"
    ).GetNamespace("MAPI")

    inbox = outlook.GetDefaultFolder(6)

    messages = inbox.Items

    messages.Sort("[ReceivedTime]", True)

    latest_message = None

    print("Cerco la mail più recente...")

    for message in messages:

        try:

            subject = message.Subject or ""

            if subject.strip() == TARGET_SUBJECT:

                latest_message = message
                break

        except Exception:
            continue

    if latest_message is None:

        print("Nessuna mail trovata.")
        return False

    mail_id = latest_message.EntryID

    if os.path.exists(LAST_MAIL_FILE):

        with open(
            LAST_MAIL_FILE,
            "r",
            encoding="utf-8"
        ) as f:

            last_id = f.read().strip()

        if last_id == mail_id:

            print("Nessuna nuova mail da processare.")
            return False

    print(f"Nuova mail trovata: {latest_message.Subject}")

    print(f"Ricevuta il: {latest_message.ReceivedTime}")

    saved = 0

    attachments = latest_message.Attachments

    for i in range(1, attachments.Count + 1):

        attachment = attachments.Item(i)

        filename = attachment.FileName

        if filename.lower().endswith(".json"):

            save_path = os.path.join(
                DATA_DIR,
                filename
            )

            attachment.SaveAsFile(save_path)

            normalize_json_file(save_path)

            print(f"Salvato e normalizzato: {filename}")

            saved += 1

    if saved == 0:

        print("La mail trovata non contiene allegati JSON.")
        return False

    with open(
        LAST_MAIL_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(mail_id)

    print(f"Totale JSON salvati: {saved}")

    return True


def git_has_changes():

    result = subprocess.run(
        [
            GIT_EXE,
            "status",
            "--porcelain",
            "--",
            "data"
        ],
        cwd=REPO_DIR,
        text=True,
        capture_output=True
    )

    print("Controllo modifiche Git:")

    print(
        result.stdout
        if result.stdout
        else "Nessuna modifica rilevata."
    )

    return bool(result.stdout.strip())


def commit_and_push():

    if not git_has_changes():

        print(
            "Mail nuova processata, "
            "ma i JSON sono identici "
            "a quelli già pubblicati."
        )

        return

    print("Aggiungo file JSON a Git...")

    if run_git(["add", "data"]) != 0:

        sys.exit("Errore durante git add.")

    commit_message = (
        "Update JSON data "
        f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    print("Creo commit...")

    commit_code = run_git([
        "commit",
        "-m",
        commit_message
    ])

    if commit_code != 0:

        print(
            "Nessun commit creato "
            "o errore durante il commit."
        )

        return

    print("Push su GitHub...")

    if run_git(["push"]) != 0:

        sys.exit("Errore durante git push.")

    print("Dashboard aggiornata su GitHub.")


def main():

    if not os.path.exists(GIT_EXE):

        sys.exit(
            f"Git non trovato qui: {GIT_EXE}"
        )

    has_new_mail = download_json_from_latest_mail()

    if has_new_mail:

        commit_and_push()

    else:

        print("Fine: nulla da aggiornare.")


if __name__ == "__main__":
    main()