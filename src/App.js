import React, { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const App = () => {
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState("Disconnected");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [clientId, setClientId] = useState(null);
    const wsRef = useRef(null);
    const [userId, setUserId] = useState("");
    const [agentId, setAgentId] = useState("");
    const [showChat, setShowChat] = useState(false);
    const [recipientNumber, setRecipientNumber] = useState("");
    const [webSocketId] = useState(uuidv4());
    const [selectedMedia, setSelectedMedia] = useState(null);
    const startClient = async () => {
        if (!userId || !agentId) {
            alert("Please enter both User ID and Agent ID.");
            return;
        }

        try {
            const response = await axios.post("http://localhost:3000/start", {
                userId: userId,
                agentId: agentId,
            });
            setClientId(response.data.clientId);
            setStatus("Starting Client...");
        } catch (error) {
            console.error("Failed to start client:", error);
            setStatus("Error starting client.");
        }
    };

    useEffect(() => {
        if (!clientId) return;

        const connectWebSocket = () => {
            const ws = new WebSocket(`ws://localhost:3000?webSocketId=${webSocketId}`);
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
                    } else if (message.type === "client_ready") {
                        setStatus("Connected");
                        setShowChat(true);
                    } else if (message.type === "message") {
                        setMessages((prevMessages) => [...prevMessages, message]);
                    } else if (message.type === "error") {
                        console.error("Error from server:", message.error);
                        setStatus("Disconnected");
                        setShowChat(false);
                    } else if (message.type === "state_change") {
                        setStatus(`State Change: ${message.state}`);
                    } else {
                        console.warn("Unknown message type:", message.type);
                    }
                } catch (error) {
                    console.error("Error parsing message:", error);
                    setStatus("Disconnected");
                    setShowChat(false);
                }
            };

            ws.onclose = () => {
                console.log("Connection closed.");
                setStatus("Disconnected");
                setShowChat(false);
                wsRef.current = null;
                setTimeout(connectWebSocket, 5000);
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setStatus("Disconnected");
                setShowChat(false);
                wsRef.current = null;
            };
        };

        connectWebSocket();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [clientId, webSocketId]);
    const handleMediaChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setSelectedMedia({
                    data: reader.result.split(',')[1], // Extract base64 data
                    mimeType: file.type,
                    filename: file.name,
                });
            };
            reader.readAsDataURL(file); // Read as data URL for base64 encoding
        }
    };
    const sendMessage = async () => {
        if (!clientId) {
            alert("No client ID. Please connect first.");
            return;
        }
        if (!recipientNumber.trim()) {
            alert("Please enter recipient number.");
            return;
        }
    
        try {
            const to = recipientNumber.includes("@")
                ? recipientNumber
                : `${recipientNumber.replace(/\D/g, "")}@c.us`;
    
            const messageData = {
                clientId: clientId,
                to: to,
            };
    
            if (selectedMedia) {
                messageData.media = selectedMedia;
                if (input.trim()) {
                    messageData.caption = input; // Send input as caption if media is present
                }
            } else if (input.trim()) { // Only send text message if input is present and no media
                messageData.message = input;
            } else { //  Handle case where neither media nor message is provided
              alert("Please enter a message or select a media file.");
              return;
            }
            
    
            const response = await axios.post("http://localhost:3000/send", messageData);
    
            // Update the messages array in the state. If it's a media message, 
            // you might need to handle displaying a preview or something similar.
            setMessages((prevMessages) => [
                ...prevMessages,
                selectedMedia ? 
                  { chatName: "You", media: selectedMedia, caption: messageData.caption } :
                  { chatName: "You", text: input }
            ]);
    
            setInput(""); // Clear the input field
            setSelectedMedia(null); // Clear selected media after sending
    
    
            console.log("Message sent successfully:", response.data);
        } catch (error) {
            console.error("Error sending message:", error);
            alert(`Error sending message: ${error.response?.data?.error || error.message}`);
        }
    };

    return (
        <div className="app-container">
            <h1>WhatsApp GPT Integration</h1>
            <p>Status: {status}</p>
    
            {!clientId && (
                <div>
                    <h2>Enter User and Agent IDs to start</h2>
                    <input
                        type="text"
                        placeholder="User ID"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Agent ID"
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                    />
                    <button onClick={startClient}>Start Client</button>
                </div>
            )}
    
            {qrCode && (
                <div>
                    <h2>Scan QR Code:</h2>
                    <QRCodeCanvas value={qrCode} size={256} />
                </div>
            )}
    
            {showChat && (
                <div className="chat-container">
                    <div className="messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.chatName === "You" ? "outgoing" : "incoming"}`}>
                                <strong>{msg.chatName}: </strong>
                                {msg.text && <span>{msg.text}</span>}
                                {msg.media && (
                                    <div>
                                        <img src={`data:${msg.media.mimeType};base64,${msg.media.data}`} alt={msg.media.filename} />
                                        {msg.caption && <span>{msg.caption}</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="input-container">
                        <input
                            type="text"
                            value={recipientNumber}
                            onChange={(e) => setRecipientNumber(e.target.value)}
                            placeholder="Recipient Number (without +)"
                        />
                        <input type="file" onChange={handleMediaChange} />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message or caption"
                        />
                        <button onClick={sendMessage}>Send</button>
                    </div>
                </div>
            )}
        </div>
    );
}
export default App;
