import secrets
from users import users
import websockets
import json

TILES_ORDERED = [
	  ["A1","A2","A3", "A4", "A5","A6","A7"],

	["B1",   "B2",     "B3",     "B4",   "B5"],

	["C1",   "C2",     "C3",     "C4",   "C5"],

	  ["D1","D2","D3", "D4", "D5","D6","D7"]
]

TILES_UNORDERED = [cell for row in TILES_ORDERED for cell in row]

def make_line(input):
	return [segment.split("|") for segment in input.split(" ")]

LINES = [make_line(line) for line in (
	"B1|C1 B2|C2 B4|C4 B5|C5",
	"A2|A3 B2|B3 C3|C4 D5|D6",
	"D2|D3 C2|C3 B3|B4 A5|A6",

	"B1|A1 B2|A2 B3|A3 A4|A5",
	"A3|A4 B3|A5 B4|A6 B5|A7",

	"C1|D1 C2|D2 C3|D3 D4|D5",
	"D3|D4 C3|D5 C4|D6 C5|D7",

	"A1|A2 B1|B2 C1|C2 D1|D2",
	"A6|A7 B4|B5 C4|C5 D6|D7"
)]

class Game:
	def __init__(self, id):
		self.players = ["", "", "", ""]
		self.board = dict.fromkeys(TILES_UNORDERED)
		self.turn = 0
		self.winner = None
		self.id = id

	def check_win(self):
		for line in LINES:
			players = [0, 1, 2, 3]
			for tile1, tile2 in line:
				players = [player for player in players if player in (self.board[tile1], self.board[tile2])]
			if len(players):
				return players[0]
		for key in self.board:
			if self.board[key] == None:
				return None
		return -1

	def next_turn(self):
		while True:
			self.turn = (self.turn + 1) % 4
			if self.players[self.turn] in users:
				break

	async def attempt_turn(self, player, tile):
		self._attempt_turn(player, tile)
		await self.send_updates()

	def _attempt_turn(self, player, tile):
		if self.winner != None or self.players.index(player) != self.turn or self.board[tile] != None:
			return
		self.board[tile] = self.players.index(player)
		self.next_turn()
		self.winner = self.check_win()

	async def send_updates(self):
		message = {
			"type": "board_update",
			"winner": self.winner,
			"state": self.board,
			"turn": self.turn,
		}
		websockets.broadcast([users[id].websocket for id in self.players if id in users], json.dumps(message))
		await self.handle_win()

	async def handle_win(self):
		if self.winner == None:
			return

		message = {
			"type": "win",
			"winner": self.winner,
			"state": self.board,
		}
		websockets.broadcast([users[id].websocket for id in self.players if id in users], json.dumps(message))
		for id in self.players:
			if id in users:
				users[id].game = None
		games.pop(self.id)

games = dict()

queue = []

def add_game():
	new_id = secrets.token_hex(8)
	while new_id in games:
		new_id = secrets.token_hex(8)
	games[new_id] = Game(new_id)
	return new_id

async def join(player_code):
	queue.append(player_code)
	await users[player_code].websocket.send(json.dumps({
		"type": "join-attempt",
		"success": True
	}))
	if len(queue) >= 4:
		id = add_game()
		websocket_list = []
		for i in range(4):
			games[id].players[i] = queue[i]
			users[queue[i]].game = id
			websocket_list.append(users[queue[i]].websocket)

		response = {
			"type": "joined",
			"turn_sequence": games[id].players,
			"players": [users[player].name for player in games[id].players if player in users]
		}
		websockets.broadcast(websocket_list, json.dumps(response))
		for i in range(4):
			queue.pop(0)

def try_cancel_join(player_code):
	if player_code not in queue:
		return False
	queue.pop(queue.index(player_code))
	return True

async def cancel_join(player_code):
	response = {
		"type": "cancel",
		"successful": try_cancel_join(player_code)
	}
	await users[player_code].websocket.send(json.dumps(response))

def handle_player_disconnect(player_code):
	try_cancel_join(player_code)
	if users[player_code].game:
		playerlist = games[users[player_code].game].players
		playerlist[playerlist.index(player_code)] = ""
	users.pop(player_code)