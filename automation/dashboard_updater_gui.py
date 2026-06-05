import subprocess
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path


REPO_DIR = Path(r"C:\Users\nicolo.bevilacqua\Desktop\Tools Fastweb\GITHUB_DASH")
PYTHON_EXE = REPO_DIR / "automation" / ".venv" / "Scripts" / "python.exe"
SCRIPT = REPO_DIR / "automation" / "update_dashboard.py"


class DashboardUpdaterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("FW Dashboard Updater")
        self.root.geometry("720x460")
        self.root.resizable(False, False)

        self.title = ttk.Label(
            root,
            text="FW Monitoring Dashboard Updater",
            font=("Segoe UI", 16, "bold")
        )
        self.title.pack(pady=(18, 4))

        self.subtitle = ttk.Label(
            root,
            text="Scarica JSON da Outlook, aggiorna GitHub e pubblica la dashboard",
            font=("Segoe UI", 10)
        )
        self.subtitle.pack(pady=(0, 18))

        self.progress = ttk.Progressbar(
            root,
            mode="indeterminate",
            length=620
        )
        self.progress.pack(pady=8)

        self.log_box = tk.Text(
            root,
            height=15,
            width=86,
            font=("Consolas", 9),
            wrap="word"
        )
        self.log_box.pack(padx=16, pady=10)
        self.log_box.config(state="disabled")

        self.button_frame = ttk.Frame(root)
        self.button_frame.pack(pady=8)

        self.run_button = ttk.Button(
            self.button_frame,
            text="Aggiorna dashboard",
            command=self.start_update
        )
        self.run_button.grid(row=0, column=0, padx=8)

        self.close_button = ttk.Button(
            self.button_frame,
            text="Chiudi",
            command=root.destroy
        )
        self.close_button.grid(row=0, column=1, padx=8)

    def write_log(self, text):
        self.log_box.config(state="normal")
        self.log_box.insert("end", text)
        self.log_box.see("end")
        self.log_box.config(state="disabled")

    def start_update(self):
        self.run_button.config(state="disabled")
        self.log_box.config(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.config(state="disabled")

        self.progress.start(10)
        self.write_log("Avvio aggiornamento dashboard...\n\n")

        thread = threading.Thread(target=self.run_update, daemon=True)
        thread.start()

    def run_update(self):
        try:
            process = subprocess.Popen(
                [str(PYTHON_EXE), str(SCRIPT)],
                cwd=str(REPO_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace"
            )

            for line in process.stdout:
                self.root.after(0, self.write_log, line)

            process.wait()

            self.root.after(0, self.finish_update, process.returncode)

        except Exception as e:
            self.root.after(0, self.finish_with_exception, str(e))

    def finish_update(self, return_code):
        self.progress.stop()
        self.run_button.config(state="normal")

        if return_code == 0:
            self.write_log("\nOperazione completata correttamente.\n")
            messagebox.showinfo(
                "Completato",
                "Dashboard aggiornata correttamente."
            )
        else:
            self.write_log(f"\nErrore. Codice uscita: {return_code}\n")
            messagebox.showerror(
                "Errore",
                "Aggiornamento fallito. Controlla il log nella finestra."
            )

    def finish_with_exception(self, error):
        self.progress.stop()
        self.run_button.config(state="normal")
        self.write_log(f"\nErrore imprevisto:\n{error}\n")
        messagebox.showerror("Errore imprevisto", error)


if __name__ == "__main__":
    root = tk.Tk()
    app = DashboardUpdaterApp(root)
    root.mainloop()