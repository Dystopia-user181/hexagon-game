const websocket = new WebSocket(
	location.href.includes("127.0.0.1") ? "ws://localhost:8001/" : ""
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

