const websocket = new WebSocket(
	location.href.toLowerCase().includes("dystopia") ?
	"wss://hexagon-game.win" :
	"ws://localhost:8001/"
);

const onReceive = {};

websocket.addEventListener("message", e => {
	const message = JSON.parse(e.data)
	for (const type in onReceive) {
		if (message.type !== type) continue;
		onReceive[type](message);
		break;
	}
});

export const Websocket = {
	websocket,
	send(data) {
		websocket.send(JSON.stringify(data));
	},
	onReceive(type, response) {
		onReceive[type] = response;
	}
}

setInterval(() => Websocket.send({ type: "ping" }), 10000)

Websocket.onReceive("pong", () => console.log("pong", new Date()))