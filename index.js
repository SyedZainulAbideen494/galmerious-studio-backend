const express = require("express");
const mysql = require("mysql2");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const nodemailer = require('nodemailer');
const uuid = require('uuid');
const cron = require('node-cron');
const PORT = process.env.PORT || 8080;
const axios = require('axios');
const stripe = require('stripe')('sk_test_51LoS3iSGyKMMAZwstPlmLCEi1eBUy7MsjYxiKsD1lT31LQwvPZYPvqCdfgH9xl8KgeJoVn6EVPMgnMRsFInhnnnb00WhKhMOq7');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');

// URL Constants
const BASE_URL = 'https://kraftpoint.in/glast';
const SUCCESS_URL = `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&sender_id=`;
const CANCEL_URL = `${BASE_URL}/cancel`;
const TICKET_URL = `${BASE_URL}/tickets/`;
const DOCUMENT_URL = `${BASE_URL}/documents/`;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
  key: "userId",
  secret: "Englishps4",
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 60 * 60 * 24 * 12,
  },
}));

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true,
}));

// Serve static files from the 'public' directory
app.use("/glast", express.static(path.join(__dirname, 'public')));

const connection = mysql.createPool({
  connectionLimit: 10, // Maximum number of connections in the pool
  host: "localhost",
  user: "root",
  password: "Englishps#4",
  database: "glamourstudio",
});

connection.getConnection((err) => {
  if (err) {
    console.error("Error connecting to MySQL database: ", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

const userStates = {};

app.post('/glast/webhook', (req, res) => {
  console.log('Incoming POST request:', JSON.stringify(req.body, null, 2)); // Log incoming POST request payload

  try {
    if (req.body && req.body.entry && req.body.entry[0].changes && req.body.entry[0].changes[0].value.messages) {
      const message = req.body.entry[0].changes[0].value.messages[0];
      const senderId = message.from; // Assuming sender ID is provided in the request
      const messageType = message.type;

      if (messageType === 'text' || messageType === 'button') {
        const messageBody = messageType === 'text' ? message.text.body.toLowerCase() : message.button.payload.toLowerCase();

        if (!userStates[senderId]) {
          userStates[senderId] = { step: 0, data: {} };
        }

        const timestamp = new Date();

        if (messageBody === 'hi') {
          const timestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds
        
          // Insert conversation details into the database
          connection.query(
            'INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
            [senderId, 'room details', timestamp],
            (err, result) => {
              if (err) {
                console.error('Error saving conversation to database:', err);
              } else {
                console.log('Conversation saved to database');
              }
            }
          );
        
          // Send WhatsApp message using a template
          try {
            sendWhatsAppMessage({
              messaging_product: "whatsapp",
              to: senderId,
              type: "template",
              template: {
                name: "_glamstudio_temp_1",
                language: { code: "en_US" },
                components: [
                  {
                    type: "header",
                    parameters: [
                      {
                        type: "video",
                        video: { link: "https://kraftpoint.in/glast/hi_vid.mp4" } // Provide a valid video link
                      }
                    ]
                  }
                ]
              }
            });
          } catch (err) {
            console.error('Error sending message:', err);
          }
        }else if (messageBody === 'explore packages') {
          connection.query('INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
            [senderId, 'room details', timestamp, senderId, 'room details', timestamp], (err, result) => {
              if (err) {
                console.error('Error saving conversation to database:', err);
              } else {
                console.log('Conversation saved to database');
              }
            });

          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "template",
            template: {
              name: "_glamstudio_temp_2", // Corrected template name
              language: { code: "en_US" }
            }
          });
        } else if (messageBody === 'availability calendar') {
          // Query to fetch all dates from the calendar table
          connection.query('SELECT date FROM calander WHERE active = 1', (err, results) => {
            if (err) {
              console.error('Error fetching unavailable dates from database:', err);
              sendWhatsAppMessage({
                messaging_product: "whatsapp",
                to: senderId,
                type: "text",
                text: {
                  body: "Sorry, we encountered an error while fetching the availability calendar. Please try again later."
                }
              });
            } else {
              const unavailableDates = results.map(row => row.date.toISOString().split('T')[0]).join(', ');
              const message = unavailableDates.length > 0 ? 
                `Hello! Unfortunately, we are not available on the following dates: ${unavailableDates}. We recommend booking an appointment or making an advance booking to ensure your spot. How can we assist you further?` : 
                'Hello! We are available on all upcoming dates. Feel free to book an appointment or make an advance booking to secure your spot. How can we assist you further?';
        
              // Insert the conversation into the phone_numbers table
              connection.query('INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
                [senderId, 'Availability Calendar', timestamp], (err, result) => {
                  if (err) {
                    console.error('Error saving conversation to database:', err);
                  } else {
                    console.log('Conversation saved to database');
                  }
                });
        
              // Send the response message with unavailable dates
              sendWhatsAppMessage({
                messaging_product: "whatsapp",
                to: senderId,
                type: "text",
                text: {
                  body: message
                }
              });
            }
          });
        } else {
          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "text",
            text: {
              body: "Sorry, I didn't understand that. Please type 'hi' for assistance."
            }
          });
        }
      }
    }

    res.sendStatus(200); // Respond to the webhook POST request
  } catch (error) {
    console.error('Error processing the webhook:', error);
    res.sendStatus(500); // Internal Server Error
  }
});


async function handlePaymentSuccess(sessionId, senderId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const ticketDetails = {
      ticketId: session.id,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details.email,
      senderId: senderId,
    };

    await connection.execute('INSERT INTO advance_ticket (ticket_id, amount, currency, customer_email, sender_id) VALUES (?, ?, ?, ?, ?)', [ticketDetails.ticketId, ticketDetails.amount, ticketDetails.currency, ticketDetails.customerEmail, ticketDetails.senderId]);

    const pdfBytes = await generateTicketPDF(ticketDetails);
    const filePath = path.join(__dirname, 'public', 'tickets', `${ticketDetails.ticketId}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);

    sendWhatsAppMessage({
      messaging_product: "whatsapp",
      to: senderId,
      type: "document",
      document: {
        link: `${TICKET_URL}${ticketDetails.ticketId}.pdf`,
        caption: 'Here is your advance booking recipt.'
      }
    });
  } catch (error) {
    console.error('Error in handlePaymentSuccess:', error);
  }
}

async function generateTicketPDF(ticketDetails) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);

  const { width, height } = page.getSize();
  const fontSize = 18;
  const text = `Ticket ID: ${ticketDetails.ticketId}\nAmount: ${ticketDetails.amount / 100}\nCustomer Email: ${ticketDetails.customerEmail}`;

  const qrCode = await QRCode.toDataURL(JSON.stringify(ticketDetails));

  const qrImage = await pdfDoc.embedPng(qrCode);
  const qrDims = qrImage.scale(0.5);

  // Center the QR code at the top
  page.drawImage(qrImage, {
    x: (width - qrDims.width) / 2,
    y: height - qrDims.height - 50,
    width: qrDims.width,
    height: qrDims.height
  });

  // Position the text below the QR code
  const textX = 50;
  const textY = height - qrDims.height - 100;

  page.drawText(text, {
    x: textX,
    y: textY,
    size: fontSize,
    font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    color: rgb(0, 0, 0),
    lineHeight: fontSize + 4
  });

  return await pdfDoc.save();
}

// Function to send WhatsApp message
function sendWhatsAppMessage(data) {
  const config = {
    headers: {
      'Authorization': 'Bearer EAAFsUoRPg1QBOzpnPGEpxBDKEw93j35D2V0Qg5C8O58FNQZAxWXWMo0XJZB6ezMoUWY6xNC6AhPGUZCjt0w8AJwuyAfkhjnZAn73tOU88pXhTxAJevtKm1GSGkDFwh5y79N1eX9LWhD3ceZAZBr36MDd1fgAy0mP9UfVDIugUDGxcl64vAhpNuj7FkbG36HGJn3RQus1iw92DiNn4w',
      'Content-Type': 'application/json'
    }
  };

  axios.post('https://graph.facebook.com/v19.0/332700683252247/messages', data, config)
    .then(response => {
      console.log('Message sent successfully:', response.data);
    })
    .catch(error => {
      console.error('Error sending message:', error.response.data);
    });
}

// Webhook verification endpoint (GET request)
const VERIFY_TOKEN = 'EAAFsUoRPg1QBOzpnPGEpxBDKEw93j35D2V0Qg5C8O58FNQZAxWXWMo0XJZB6ezMoUWY6xNC6AhPGUZCjt0w8AJwuyAfkhjnZAn73tOU88pXhTxAJevtKm1GSGkDFwh5y79N1eX9LWhD3ceZAZBr36MDd1fgAy0mP9UfVDIugUDGxcl64vAhpNuj7FkbG36HGJn3RQus1iw92DiNn4w';

app.get('/glast/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});



// GET endpoint for testing
app.get('/glast', (req, res) => {
  res.send('Welcome to the Facebook Messenger webhook!');
});

// Success endpoint to handle successful payments
app.get('/glast/success', async (req, res) => {
  const sessionId = req.query.session_id;
  const senderId = req.query.sender_id;
  if (!sessionId || !senderId) {
    return res.status(400).send('Missing session_id or sender_id');
  }
  try {
    await handlePaymentSuccess(sessionId, senderId);
    res.send('Payment successful! Your recipt has been sent to your WhatsApp.');
  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).send('An error occurred while processing your payment.');
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});