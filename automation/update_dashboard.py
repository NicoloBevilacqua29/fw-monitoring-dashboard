import os
import subprocess
import sys
from datetime import datetime

import win32com.client


REPO_DIR = r"C:\Users\nicolo.bevilacqua\Desktop\Tools Fastweb\GITHUB_DASH"
DATA_DIR = os.path.join(REPO_DIR, "data")
AUTOMATION_DIR = os.path.join(REPO_DIR, "automation")
LAST_MAIL_FILE = os.path.join(AUTOMATION_DIR, "last_mail.txt")

TARGET_SUBJECT = "[External] Informatica WebServiceHub status - as008pwc"


def run_git(command):
    result = subprocess.run(
        command,
        cwd=REPO_DIR,
        text=True,
        capture_output=True,
        shell=True
    )

    if result.stdout:
        print(result.stdout)

    if result.stderr:
        print(result.stderr)

    return result.returncode


def download_json_from_latest_mail():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("Connessione a Outlook...")
    outlook = win32com.client.Dispatch("Outlook.Application").GetNamespace("MAPI")
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
        with open(LAST_MAIL_FILE, "r", encoding="utf-8") as f:
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
            save_path = os.path.join(DATA_DIR, filename)
            attachment.SaveAsFile(save_path)
            print(f"Salvato: {filename}")
            saved += 1

    if saved == 0:
        print("La mail trovata non contiene allegati JSON.")
        return False

    with open(LAST_MAIL_FILE, "w", encoding="utf-8") as f:
        f.write(mail_id)

    print(f"Totale JSON salvati: {saved}")
    return True


def git_has_changes():
    result = subprocess.run(
        "git status --porcelain data",
        cwd=REPO_DIR,
        text=True,
        capture_output=True,
        shell=True
    )

    return bool(result.stdout.strip())


def commit_and_push():
    if not git_has_changes():
        print("Nessuna modifica JSON da pubblicare.")
        return

    print("Aggiungo file JSON a Git...")
    if run_git("git add data/*.json") != 0:
        sys.exit("Errore durante git add.")

    commit_message = f"Update JSON data {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    print("Creo commit...")
    commit_code = run_git(f'git commit -m "{commit_message}"')

    if commit_code != 0:
        print("Nessun commit creato o errore durante il commit.")
        return

    print("Push su GitHub...")
    if run_git("git push") != 0:
        sys.exit("Errore durante git push.")

    print("Dashboard aggiornata su GitHub.")


def main():
    has_new_mail = download_json_from_latest_mail()

    if has_new_mail:
        commit_and_push()
    else:
        print("Fine: nulla da aggiornare.")


if __name__ == "__main__":
    main()