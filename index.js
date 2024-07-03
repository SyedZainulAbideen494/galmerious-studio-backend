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
const moment = require('moment');

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
        } else if (messageBody === 'custom events package') {
          userStates[senderId].step = 20; // Update user state to indicate the current step
          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "text",
            text: {
              body: "That sounds exciting! 😊\n\nPlease share with us the details of your custom events package.\nWe'd love to know about your event, including the name, type, date, number of guests,\nand any special requests or preferences you have.\n\nThis will help us tailor our services just for you!"
            }
          });
        } else if (userStates[senderId].step === 20) {
          const issueDescription = messageBody;
          // Here you can save the issue to a database or handle it accordingly.
          userStates[senderId].step = 0;
          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "text",
            text: { body: "Thank you for the details. Our team will get back to you shortly." }
          });
        } else if (messageBody === 'explore packages') {
          const pdfUrl = 'https://kraftpoint.in/glast/glamourstudiobrochure.pdf'; // Replace with your actual PDF URL

          // Save conversation to database for the first message (template message)
          connection.query(
            'INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
            [senderId, 'Nikah + Valima Combo', timestamp],
            (err, result) => {
              if (err) {
                console.error('Error saving conversation to database:', err);
              } else {
                console.log('Conversation saved to database');

                // Send WhatsApp template message
                sendWhatsAppMessage({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: senderId,
                  type: "document",
                  document: {
                    link: "https://kraftpoint.in/glast/glamourstudiobrochure.pdf",
                    caption: "Check out our brochure"
                  }
                });
              }
            }
          );

          // Send WhatsApp message with PDF attachment
          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "template",
            template: {
              name: "_glamstudio_temp_2", // Corrected template name
              language: { code: "en_US" }
            }
          });
        } else if (messageBody === 'nikah + valima combo' || messageBody === 'full wedding package') {
          const conversationType = messageBody === 'nikah + valima combo' ? 'Nikah + Valima Combo' : 'Full Wedding Package';
          connection.query(
            'INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
            [senderId, conversationType, timestamp],
            (err, result) => {
              if (err) {
                console.error('Error saving conversation to database:', err);
              } else {
                console.log('Conversation saved to database');

                // Send WhatsApp template message
                sendWhatsAppMessage({
                  messaging_product: "whatsapp",
                  to: senderId,
                  type: "template",
                  template: {
                    name: "glamours_studio_temp_4", // Corrected template name
                    language: { code: "en_US" }
                  }
                });
              }
            }
          );
        } else if (messageBody === 'availability calendar') {
          // Query to fetch all dates from the calendar table
          connection.query('SELECT date FROM calendar WHERE active = 1', (err, results) => {
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
              return;
            }

            // Format the fetched dates
            const unavailableDates = results
              .map(result => `\n- ${moment(result.date).format('YYYY-MM-DD')}`)
              .join('\n');

            // Send the message with the unavailable dates
            sendWhatsAppMessage({
              messaging_product: "whatsapp",
              to: senderId,
              type: "text",
              text: {
                body: `The following dates are currently unavailable:\n${unavailableDates}\n\nWe recommend booking your appointment on available dates.`
              }
            });
          });
        } else if (messageBody === 'book appointment') {
          connection.query(
            'INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
            [senderId, 'book appointment', timestamp],
            (err, result) => {
              if (err) {
                console.error('Error saving conversation to database:', err);
              } else {
                console.log('Conversation saved to database');
              }
            }
          );

          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "template",
            template: {
              name: "galmorus_studio_temp_5", // Corrected template name
              language: { code: "en_US" }
            }
          });
        } else if (messageBody === 'advance booking') {
          connection.query(
            'INSERT INTO phone_numbers (phone_number, conversation_type, created_at) VALUES (?, ?, ?)',
            [senderId, 'advance booking', timestamp],
            (err, result) => {
              if (err) {
                console.error('Error saving conversation to database:', err);
              } else {
                console.log('Conversation saved to database');
              }
            }
          );

          // Create a Stripe checkout session
          stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
              price_data: {
                currency: 'inr',
                product_data: {
                  name: 'Advance Booking',
                },
                unit_amount: 300000, // ₹3000.00
              },
              quantity: 1,
            }],
            mode: 'payment',
            success_url: `${SUCCESS_URL}${senderId}`,
            cancel_url: CANCEL_URL,
          }).then(session => {
            sendWhatsAppMessage({
              messaging_product: "whatsapp",
              to: senderId,
              type: "text",
              text: {
                body: `Please complete your payment by clicking the link below:\n${session.url}`
              }
            });
          }).catch(err => {
            console.error('Error creating Stripe checkout session:', err);
            sendWhatsAppMessage({
              messaging_product: "whatsapp",
              to: senderId,
              type: "text",
              text: {
                body: "Sorry, we encountered an error while processing your booking. Please try again later."
              }
            });
          });
        } else {
          // Default response for unrecognized messages
          sendWhatsAppMessage({
            messaging_product: "whatsapp",
            to: senderId,
            type: "text",
            text: { body: "I'm sorry, I don't understand that command. Please type 'hi' to get started." }
          });
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send('Error processing request');
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