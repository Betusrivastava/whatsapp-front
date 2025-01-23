import React, { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

const App = () => {
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState("Disconnected");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [clientId, setClientId] = useState(null);
    const wsRef = useRef(null);

    // Hardcoded user and agent IDs
    const userId = "6690ee14f0efd9b4669e6404";
    const agentId = "66bc9a39d0276f2e54449cd0";

    useEffect(() => {
        const connectWebSocket = () => {
            const ws = new WebSocket("ws://localhost:3000"); // WebSocket URL
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("WebSocket connection opened.");
                setStatus("Connecting...");
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log("Received message:", message);

                    if (message.type === "qr") {
                        setQrCode(message.qr);
                    } else if (message.type === "client_ready" && message.clientId === `${userId}_${agentId}`) {
                        setClientId(message.clientId);
                        setStatus("Connected");
                    } else if (message.type === "message") {
                        setMessages((prevMessages) => [...prevMessages, message]);
                    } else if (message.type === "error") {
                        console.error("Error from server:", message.error);
                        setStatus("Disconnected");
                    } else {
                        console.warn("Unknown message type:", message.type);
                    }
                } catch (error) {
                    console.error("Error parsing message:", error);
                    setStatus("Disconnected");
                }
            };

            ws.onclose = () => {
                console.log("Connection closed.");
                setStatus("Disconnected");
                wsRef.current = null;
                // Attempt to reconnect after 5 seconds
                setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setStatus("Disconnected");
                wsRef.current = null;
            };
        };

        connectWebSocket();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [userId, agentId]);

    const sendMessage = () => {
        if (!clientId) {
            alert("No client ID. Please connect first.");
            return;
        }
        if (!input.trim()) return;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(
                    JSON.stringify({
                        type: "send_message",
                        clientId: `${userId}_${agentId}`,
                        message: input,
                    })
                );
                setMessages((prevMessages) => [
                    ...prevMessages,
                    { chatName: "You", text: input },
                ]);
                setInput("");
            } catch (error) {
                console.error("Error sending message:", error);
                setStatus("Disconnected");
                alert("Error sending message.");
            }
        } else {
            alert("WebSocket connection is not open.");
        }
    };

    return (
        <div className="app-container">
            <h1>WhatsApp GPT Integration</h1>
            <p>Status: {status}</p>

            {qrCode && (
                <div>
                    <h2>Scan QR Code:</h2>
                    <QRCodeCanvas value={qrCode} size={256} />
                </div>
            )}

            <div className="chat-container">
                <div className="messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`message ${msg.chatName === "You" ? "outgoing" : "incoming"}`}>
                            <strong>{msg.chatName}: </strong>
                            <span>{msg.text}</span>
                        </div>
                    ))}
                </div>
                <div className="input-container">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message"
                    />
                    <button onClick={sendMessage}>Send</button>
                </div>
            </div>
        </div>
    );
};

export default App;