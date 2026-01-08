import os

async def send_plan():
    uri = "ws://localhost:3000"
    
    # Use the current file itself as the target for demonstration
    current_file_path = os.path.abspath(__file__)
    
    async with websockets.connect(uri) as websocket:
        plan = {
            "planId": "test-123",
            "status": "suggestion",
            "targets": [
                {
                    "filePath": current_file_path,
                    "lines": [5, 6],
                    "reason": "Blue: Logic Change",
                    "changeType": "logic_change"
                },
                {
                    "filePath": current_file_path,
                    "lines": [7, 8],
                    "reason": "Green: Refactor",
                    "changeType": "refactor"
                },
                {
                    "filePath": current_file_path,
                    "lines": [9, 10],
                    "reason": "Yellow: Suggestion",
                    "changeType": "suggestion"
                }
            ]
        }
        await websocket.send(json.dumps(plan))
        print("Plan sent to VS Code!")

if __name__ == "__main__":
    try:
        asyncio.run(send_plan())
    except ConnectionRefusedError:
        print("\n\u274c Error: Could not connect to VS Code extension.")
        print("   Please make sure the extension is running (F5 in VS Code) and listening on port 3000.")
    except Exception as e:
        print(f"\n\u274c An unexpected error occurred: {e}")