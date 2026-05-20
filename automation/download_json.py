import os
import win32com.client

DEST_DIR = r"C:\Users\nicolo.bevilacqua\Desktop\Tools Fastweb\GITHUB_DASH\data"

TARGET_SUBJECT = "[External] Informatica WebServiceHub status - as008pwc"

LAST_MAIL_FILE = "last_mail.txt"

os.makedirs(DEST_DIR, exist_ok=True)

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
    raise SystemExit

mail_id = latest_message.EntryID

# Controllo se la mail è già stata processata
if os.path.exists(LAST_MAIL_FILE):

    with open(LAST_MAIL_FILE, "r") as f:
        last_id = f.read().strip()

    if last_id == mail_id:
        print("Nessuna nuova mail da processare.")
        raise SystemExit

print(f"Nuova mail trovata:")
print(latest_message.Subject)
print(latest_message.ReceivedTime)

saved = 0

attachments = latest_message.Attachments

for i in range(1, attachments.Count + 1):

    attachment = attachments.Item(i)
    filename = attachment.FileName

    if filename.lower().endswith(".json"):

        save_path = os.path.join(DEST_DIR, filename)

        attachment.SaveAsFile(save_path)

        print(f"Salvato: {filename}")

        saved += 1

# Salva ID ultima mail processata
with open(LAST_MAIL_FILE, "w") as f:
    f.write(mail_id)

print(f"\nTotale JSON salvati: {saved}")