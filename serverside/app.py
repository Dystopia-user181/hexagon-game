import asyncio
import websockets
import json
import os

import users
import games

async def error(websocket, message):
	event = {
		"type": "error",
		"message": message
	}
	await websocket.send(json.dumps(event))

async def handler(websocket):
	"""
	Handle a connection and dispatch it according to who is connecting.

	"""
	# Receive and parse the "init" event from the UI.
	event = { "type": "none" }
	while event["type"] != "init":
		message = await websocket.recv()
		try:
			event = json.loads(message)
		except:
			error(websocket, "Invalid JSON")
		if event["type"] == "ping":
			await websocket.send(json.dumps({ "type" : "pong" }))
	id = users.add_user(event["name"])
	users.users[id].websocket = websocket
	response = {
		"type": "init",
		"id": id,
	}
	await websocket.send(json.dumps(response))
	try:
		async for m in websocket:
			try:
				message = json.loads(m)
			except:
				error(websocket, "Invalid JSON")
				continue
			if event["type"] == "ping":
				await websocket.send(json.dumps({ "type" : "pong" }))
			elif message["type"] == "join":
				await games.join(id)
			elif message["type"] == "cancel":
				await games.cancel_join(id)
			elif message["type"] == "play":
				if users.users[id].game == None:
					continue
				try:
					await games.games[users.users[id].game].attempt_turn(id, message["tile"])
				except Exception as e:
					print(e)
					await error(websocket, "Something went wrong")
	finally:
		await games.handle_player_disconnect(id)

async def main():
	# Set the stop condition when receiving SIGTERM.
	loop = asyncio.get_running_loop()
	stop = loop.create_future()
	# loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)

	port = int(os.environ.get("PORT", "8001"))
	async with websockets.serve(handler, "", port):
		await stop


if __name__ == "__main__":
	asyncio.run(main())