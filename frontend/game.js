import { Websocket } from "./websocket.js";

const playerData = {
	name: null,
	id: null,
};

const tabs = new Map([
	["titlescreen", document.getElementById("titlescreen-tab")],
	["joingame", document.getElementById("joingame-tab")],
	["joininggame", document.getElementById("joininggame-tab")],
	["gameboard", document.getElementById("gameboard-tab")],
	["disconnected", document.getElementById("disconnected-tab")]
]);

function showTab(tab) {
	for (const [_, tabElement] of tabs) {
		tabElement.style.display = "none";
	}
	tabs.get(tab).style.display = "";
}

showTab("titlescreen");

const startPlayingButton = document.getElementById("startplaying-button");
startPlayingButton.addEventListener("click", () => {
	playerData.name = document.getElementById("name").value || `Guest ${Math.floor(Math.random() * 1000000)}`;
	document.getElementById("welcome-message").innerText = `Welcome, ${playerData.name}!`;
	Websocket.send({ type: "init", name: playerData.name });
	startPlayingButton.disabled = true;
});

const joinGameButton = document.getElementById("joingame-button");
joinGameButton.addEventListener("click", () => {
	Websocket.send({ type: "join" });
	joinGameButton.disabled = true;
});

const cancelGameButton = document.getElementById("cancel-button");
cancelGameButton.addEventListener("click", () => {
	Websocket.send({ type: "cancel" });
	cancelGameButton.disabled = true;
});

Websocket.onReceive("init", ({ id }) => {
	playerData.id = id;
	showTab("joingame");
	startPlayingButton.disabled = false;
});

Websocket.onReceive("join-attempt", () => {
	showTab("joininggame");
	joinGameButton.disabled = false;
});

Websocket.onReceive("cancel", ({ successful }) => {
	if (successful) showTab("joingame");
	cancelGameButton.disabled = false;
});

const currentGame = {
	turnSequence: [],
	players: [],
	board: {},
	turn: 0,
	winner: null,
}

window.currentGame = currentGame;
window.playerData = playerData;

const polygons = [ ...document.getElementById("gameboard").children ];
for (const polygon of polygons) {
	currentGame.board[polygon.id] = null;
	polygon.addEventListener("click", () => {
		if (currentGame.turn !== currentGame.turnSequence.indexOf(playerData.id)) return;
		if (currentGame.board[polygon.id] !== null) return;
		if (currentGame.winner !== null) return;
		Websocket.send({
			type: "play",
			tile: polygon.id
		});
	});
	const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
	text.id = `${polygon.id}_text`;
	text.setAttribute("text-anchor", "middle");
	text.setAttribute("dominant-baseline", "central");
	const pos = polygon.points;
	if (pos.length === 3) {
		text.style.font = "0.18px Arial";
		const a = Math.sqrt((pos[2].x - pos[1].x) ** 2 + (pos[2].y - pos[1].y) ** 2);
		const b = Math.sqrt((pos[0].x - pos[2].x) ** 2 + (pos[0].y - pos[2].y) ** 2);
		const c = Math.sqrt((pos[0].x - pos[1].x) ** 2 + (pos[0].y - pos[1].y) ** 2);
		text.setAttribute("x", String((a * pos[0].x + b * pos[1].x + c * pos[2].x) / (a + b + c)));
		text.setAttribute("y", String((a * pos[0].y + b * pos[1].y + c * pos[2].y) / (a + b + c)));
	} else {
		text.style.font = "0.25px Arial";
		const s1 = (pos[2].y - pos[0].y) / (pos[2].x - pos[0].x);
		const s2 = (pos[3].y - pos[1].y) / (pos[3].x - pos[1].x);
		if (s2 === 0) {
			text.setAttribute("x", pos[2].x * 0.8);
			text.setAttribute("y", pos[3].y * 0.8);
		} else if (s1 === 0) {
			text.setAttribute("x", pos[3].x * 0.8);
			text.setAttribute("y", pos[2].y * 0.8);
		} else {
			const c1 = pos[0].y - s1 * pos[0].x;
			const c2 = pos[1].y - s2 * pos[1].x;
			text.setAttribute("x", String((c2 - c1) * 0.8 / (s1 - s2)));
			text.setAttribute("y", String((c2 * s1 - c1 * s2) * 0.8 / (s1 - s2)));
		}
	}
	text.style.fill = "#0008";
	document.getElementById("gameboard").appendChild(text);
}

Websocket.onReceive("joined", (e) => {
	showTab("gameboard");
	currentGame.turnSequence = e.turn_sequence;
	currentGame.players = e.players;
	currentGame.turn = 0;
	currentGame.winner = null;
	for (const polygon of polygons) {
		polygon.setAttribute("fill", "white");
		document.getElementById(`${polygon.id}_text`).textContent = "";
		currentGame.board[polygon.id] = null;
		polygon.style.cursor = "pointer";
	}
	for (let i = 0; i < 4; i++) {
		document.getElementById(`player${i + 1}-you`).style.display = "none";
		document.getElementById(`player${i + 1}-name`).innerText = e.players[i];
		document.getElementById(`player${i + 1}`).style.fontWeight = "normal";
		document.getElementById(`player${i + 1}`).style.color = "grey";
	}
	document.getElementById(`player${e.turn_sequence.indexOf(playerData.id) + 1}-you`).style.display = "inline";
	document.getElementById(`player1`).style.fontWeight = "bold";
	document.getElementById(`player1`).style.color = "black";
	document.getElementById("winner-text").textContent = "";
	document.getElementById("back-button").style.visibility = "hidden";
	if (currentGame.turnSequence.indexOf(playerData.id) === 0)
		document.getElementById("gameboard").style.pointerEvents = "auto";
	else
		document.getElementById("gameboard").style.pointerEvents = "none";
});

const colours = ["#c67789", "#b6c155", "#55c198", "#65abc8"];
Websocket.onReceive("board_update", e => {
	console.log(e)
	currentGame.board = e.state;
	currentGame.turn = e.turn;
	currentGame.winner = e.winner;
	for (const key in e.state) {
		if (e.state[key] !== null) {
			document.getElementById(key).setAttribute("fill", colours[e.state[key]]);
			document.getElementById(`${key}_text`).textContent = e.state[key] + 1;
			document.getElementById(key).style.cursor = "not-allowed";
		}
	}
	if (e.winner !== null) {
		const self = currentGame.turnSequence.indexOf(playerData.id);
		document.getElementById("winner-text").textContent = `${e.winner === self ? "You" : `Player ${e.winner + 1}`} won!`;
		if (e.winner === -1) document.getElementById("winner-text").textContent = "Draw";
		document.getElementById("back-button").style.visibility = "visible";
		return;
	}
	for (let i = 0; i < 4; i++) {
		document.getElementById(`player${i + 1}`).style.fontWeight = "normal";
		document.getElementById(`player${i + 1}`).style.color = "grey";
	}
	document.getElementById(`player${e.turn + 1}`).style.fontWeight = "bold";
	document.getElementById(`player${e.turn + 1}`).style.color = "black";
	if (currentGame.turn === currentGame.turnSequence.indexOf(playerData.id))
		document.getElementById("gameboard").style.pointerEvents = "auto";
	else
		document.getElementById("gameboard").style.pointerEvents = "none";
});

document.getElementById("back-button").addEventListener("click", () => {showTab("joingame")});

Websocket.websocket.addEventListener("close", () => showTab("disconnected"));

Websocket.websocket.addEventListener("error", ({ message }) => {
	throw new Error("Websocket: " + message);
});