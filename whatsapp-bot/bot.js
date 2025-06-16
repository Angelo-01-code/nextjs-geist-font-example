const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('./config');
const { processImage } = require('./ocr');

// Create necessary directories
config.createDirs();

// Initialize WhatsApp client
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Load message templates
let mensajes = {};
try {
    mensajes = require('./mensajes.json');
} catch (error) {
    console.error('Error loading mensajes.json:', error);
    process.exit(1);
}

// Utility function for delays
const delay = ms => new Promise(res => setTimeout(res, ms));

// Function to send messages with delay
async function sendMessages(chat, messages, replacements = {}) {
    try {
        await delay(config.initialDelay);
        
        for (const message of messages) {
            let finalMessage = message;
            
            // Replace placeholders with actual values
            for (const [key, value] of Object.entries(replacements)) {
                finalMessage = finalMessage.replace(`{${key}}`, value);
            }
            
            await chat.sendMessage(finalMessage);
            await delay(config.messageDelay);
        }
    } catch (error) {
        console.error('Error sending messages:', error);
    }
}

// Handle QR code generation
client.on('qr', (qr) => {
    console.log('QR Code received. Scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Handle ready event
client.on('ready', () => {
    console.log('WhatsApp bot is ready!');
});

// Handle authentication failures
client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
});

// Handle disconnected event
client.on('disconnected', (reason) => {
    console.log('Client was disconnected:', reason);
});

// Handle incoming messages
client.on('message', async msg => {
    try {
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const contactName = contact.pushname || contact.number;

        // Handle image messages (comprobantes)
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            
            if (media.mimetype.startsWith('image/')) {
                // Save image temporarily
                const tempImagePath = path.join(config.mediaPath, `temp_${Date.now()}.png`);
                await fs.writeFile(tempImagePath, media.data, 'base64');

                console.log(`Processing image from ${contactName}...`);

                // Process image with OCR
                const result = await processImage(tempImagePath, contactName);

                // Remove temporary image
                await fs.remove(tempImagePath);

                // Send appropriate response
                if (result.aceptado) {
                    await sendMessages(chat, mensajes.comprobante_aceptado);
                } else {
                    await sendMessages(chat, mensajes.comprobante_rechazado, {
                        motivo: result.motivo
                    });
                }
            }
            return;
        }

        // Handle text messages
        const messageText = msg.body.toLowerCase().trim();
        
        // Find matching response or use default
        let responseKey = 'default';
        for (const key of Object.keys(mensajes)) {
            if (messageText.includes(key)) {
                responseKey = key;
                break;
            }
        }

        await sendMessages(chat, mensajes[responseKey]);

    } catch (error) {
        console.error('Error processing message:', error);
        
        // Try to send error message to user
        try {
            await msg.reply('Lo siento, ocurrió un error. Por favor, intenta nuevamente.');
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
});

// Initialize client
client.initialize().catch(error => {
    console.error('Failed to initialize client:', error);
    process.exit(1);
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await client.destroy();
    process.exit();
});
