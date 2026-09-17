import os
import sys
import time
import json
import subprocess
import webbrowser

def bootstrap_dependency(package_name, import_name=None):
    if import_name is None:
        import_name = package_name
    try:
        __import__(import_name)
    except ImportError:
        print(f"[*] Bootstrapping dependency: {package_name} is missing. Installing...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
            print(f"[+] Successfully installed {package_name}!")
        except Exception as e:
            print(f"[-] Auto-install failed for {package_name}: {e}")

bootstrap_dependency("websockets")
bootstrap_dependency("pyautogui")

import asyncio
import websockets
import pyautogui

pyautogui.FAILSAFE = False
PORT = 8765

print("\n" + "="*60)
print(" J.A.R.V.I.S. DESKTOP UPLINK ACTIVE")
print(f" Server running on host: localhost | Port: {PORT}")
print(" Keep this terminal open in the background to control your physical laptop.")
print("="*60 + "\n")

async def handle_client(websocket, path=None):
    print(f"[Connected] New J.A.R.V.I.S. session established via local port {PORT}")
    await websocket.send(json.dumps({
        "type": "status",
        "message": "Desktop Uplink secure. Core systems synced, sir."
    }))

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                payload = data.get("payload")
                print(f"[Command] Received Instruction: '{action}' with parameters: {payload}")
                response_text = f"Action {action} handled."
                
                if action == "open_application":
                    app = str(payload).lower()
                    if "notepad" in app:
                        subprocess.Popen(["notepad.exe"])
                        response_text = "Notepad booted up."
                    elif "calculator" in app or "calc" in app:
                        subprocess.Popen(["calc.exe"])
                        response_text = "Calculator launched."
                    elif "chrome" in app or "browser" in app:
                        os.system("start chrome")
                        response_text = "Google Chrome launched."
                    elif "code" in app or "vs code" in app:
                        os.system("code")
                        response_text = "VS Code editor initialized."
                    elif "explorer" in app or "files" in app or "folder" in app:
                        subprocess.Popen(["explorer.exe"])
                        response_text = "Windows Explorer open."
                    elif "cmd" in app or "terminal" in app:
                        subprocess.Popen(["cmd.exe"])
                        response_text = "Command Prompt launched."
                    elif "taskmgr" in app or "task manager" in app:
                        subprocess.Popen(["taskmgr.exe"])
                        response_text = "Task Manager open."
                    else:
                        os.system(f"start {app}")
                        response_text = f"Executed generic start command for {app}."
                elif action == "open_url":
                    url = str(payload)
                    webbrowser.open(url)
                    response_text = f"Navigated browser to {url}."
                elif action == "type_text":
                    text = str(payload)
                    pyautogui.write(text, interval=0.01)
                    response_text = f"Typed sequence: '{text}'"
                elif action == "keypress":
                    key = str(payload).lower()
                    pyautogui.press(key)
                    response_text = f"Executed keypress: '{key}'"
                elif action == "media_action":
                    cmd = str(payload).lower()
                    if "up" in cmd or "raise" in cmd:
                        pyautogui.press("volumeup", presses=5)
                        response_text = "Volume adjusted upwards."
                    elif "down" in cmd or "lower" in cmd:
                        pyautogui.press("volumedown", presses=5)
                        response_text = "Volume adjusted downwards."
                    elif "mute" in cmd:
                        pyautogui.press("volumemute")
                        response_text = "Muted system sound."
                    elif "play" in cmd or "pause" in cmd:
                        pyautogui.press("playpause")
                        response_text = "Toggled active workspace media."
                elif action == "execute_cmd":
                    command = str(payload)
                    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    stdout, stderr = process.communicate()
                    response_text = stdout if stdout else stderr
                    if not response_text:
                        response_text = f"Executed command successfully: {command}"
                        
                await websocket.send(json.dumps({
                    "type": "status",
                    "message": response_text
                }))
            except Exception as inner_e:
                print(f"[Error] Execution failure: {inner_e}")
                await websocket.send(json.dumps({
                    "type": "status",
                    "message": f"Execution error: {str(inner_e)}"
                }))
    except websockets.exceptions.ConnectionClosed as e:
        print(f"[Disconnected] J.A.R.V.I.S. connection severed: {e}")

async def main():
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        await asyncio.Future()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[+] Exiting J.A.R.V.I.S. successfully.")
