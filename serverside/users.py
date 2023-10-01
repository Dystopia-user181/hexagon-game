import secrets

class User:
	def __init__(self, name, id):
		self.name = name
		self.id = id
		self.game = None
		self.websocket = None

users = dict()

def add_user(name):
	new_id = secrets.token_hex(8)
	while new_id in users:
		new_id = secrets.token_hex(8)
	users[new_id] = User(name, new_id)
	return new_id

def user_exists(id):
	return id in users