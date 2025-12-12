const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
// const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenerativeAI } = require("@google/generative-ai");


const usermodel = require('./models/usermodel.js');
const nodemailer = require('nodemailer');
const fs = require("fs");

const PORT = process.env.PORT || 5000;
app.use(cors());

// Connect to MongoDB
// mongoose.connect('mongodb+srv://vardhanjay84:U4FD81ubMhrTmo5I@cluster0.ktrkfrk.mongodb.net/cluster0?')
//   .then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.error('Error connecting to MongoDB:', err));

mongoose.connect('mongodb+srv://chandumajji0584:0PIBDsmPIKM5Na4G@testing.fgnrq.mongodb.net/')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));

// const key = "AIzaSyB3hLtxohmonVe_fNKSnOFnQMpDs8JSrIU";
const key = "AIzaSyBil5JIleXAdgs6gSZBm2T7fDL1vTNKoiY";

const genAI = new GoogleGenerativeAI(  key );

// const genAI = new GoogleGenerativeAI(key);

// Define mongoose schema
const studentSchema = new mongoose.Schema({
  rollNumber: {
    type: String,
    unique: true
  },
  marks: Number,
  topic: String,
  maxque: Number
});

// Middleware to parse JSON bodies
app.use(express.json());

// Define the POST route to create a room and student record
app.post('/setroom', async (req, res) => {
  const { topic, maxque, generatedCode } = req.body;
  const rollNumber = "0";
  const marks = 0;
  try {
    // Create a collection dynamically
    const StudentCollection = mongoose.model(generatedCode, studentSchema);
    console.log(StudentCollection);
    await StudentCollection.createCollection();
    console.log(`Collection created successfully: ${generatedCode}`);

    const newStudent = new StudentCollection({
      rollNumber,
      marks,
      topic,
      maxque: parseInt(maxque), // Convert maxque to a number
    });

    try {
      const savedStudent = await newStudent.save();
      console.log('Student saved successfully:', savedStudent);
      res.status(200).json(savedStudent); // Send success response
    } catch (error) {
      console.error('Error saving student:', error);
      res.status(500).json({ error: 'Error saving student' }); // Send error response
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' }); // Send internal server error response
  }
});

// Route to authenticate the student and check if collection exists
app.post('/auth', async (req, res) => {
  const { code, rollNo } = req.body;
  console.log(rollNo);
  try {
    // Check if the collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionExists = collections.some(collection => collection.name === code);

    if (collectionExists) {
      console.log(`Collection '${code}' exists`);
      try {
        const StudentCollection = mongoose.model(code, studentSchema);
        console.log(StudentCollection);
        const student = await StudentCollection.findOne({});
        const studentt = await StudentCollection.findOne({ rollNumber: rollNo });
        if (!studentt) {
          const newStudent = new StudentCollection({
            rollNumber: rollNo,
            marks: student.marks,
            topic: student.topic,
            maxque: parseInt(student.maxque) // Convert maxque to a number
          });
          res.status(200).json({ message: 'Take Test', maxque: student.maxque, topic: student.topic });

          const savedStudent = await newStudent.save();
          console.log(savedStudent);
        } else res.status(201).json({ message: 'Student Exists' });
      } catch (error) {
        console.error("Error finding student:", error);
      }
    } else {
      console.log(`Collection '${code}' does not exist`);
      res.status(404).json({ message: 'Collection does not exist' });
    }
  } catch (error) {
    console.error('Error checking collection:', error);
    res.status(500).json({ message: 'Error checking collection' });
  }
});

 // Generate quiz questions dynamically using Google Gemini AI
app.post('/api/generateQuestions', async (req, res) => {
  try {
    const { topic, answered, maxque } = req.body;

    const prompt = `
      Generate a multiple-choice quiz on the topic "${topic}" in the following format:

      Question: <question text>
      Options:
      A) <option 1>
      B) <option 2>
      C) <option 3>
      D) <option 4>

      Correct Answer: <A/B/C/D>

      Requirements:
      • Difficulty level: ${answered}/${maxque}
      • Do NOT add extra characters or formatting.
      • Do NOT modify label names.
    `;

    // FIX 1: Correct Model
    // const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
// const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro" });


    // FIX 2: Correct API Usage (NO ARRAY!)
    const result = await model.generateContent(prompt);

    if (!result || !result.response) {
      throw new Error("No response from Gemini");
    }

    const resultText = result.response.text().trim();
    console.log("Generated Content:", resultText);

    const lines = resultText.split("\n").map(l => l.trim());

    // Extract Question
    const questionLine = lines.find(l => l.startsWith("Question:"));
    const question = questionLine?.replace("Question:", "").trim();

    // Extract options
    const options = ["A)", "B)", "C)", "D)"].map(label => {
      const optLine = lines.find(l => l.startsWith(label));
      return optLine ? optLine.replace(label, "").trim() : null;
    });

    // Extract correct answer
    const correctLine = lines.find(l => l.startsWith("Correct Answer:"));
    const correctAnswer = correctLine
      ?.replace("Correct Answer:", "")
      .trim()
      .charAt(0);

    // Validation
    if (!question || options.includes(null) || !correctAnswer) {
      return res.status(500).json({
        error: "Invalid AI output format",
        raw: resultText
      });
    }

    const responseObj = { question, options, correctAnswer };

    console.log("Parsed Output:", responseObj);
    res.json(responseObj);

  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// const axios = require("axios");

// app.post('/api/generateQuestions', async (req, res) => {
//   try {
//     const { topic, answered, maxque } = req.body;

//     const prompt = `
// Generate a multiple-choice quiz on the topic "${topic}" in the exact following format:

// Question: <question text>
// Options:
// A) <option 1>
// B) <option 2>
// C) <option 3>
// D) <option 4>

// Correct Answer: <A/B/C/D>

// Rules:
// • Difficulty level ${answered}/${maxque}
// • Do NOT add extra characters.
// • Do NOT change labels.
// `;

//     const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${key}`;

//     const response = await axios.post(url, {
//       contents: [
//         {
//           parts: [{ text: prompt }]
//         }
//       ]
//     });

//     const text = response.data.candidates[0].content.parts[0].text.trim();
//     console.log("AI Output:", text);

//     const lines = text.split("\n").map(line => line.trim());

//     const question = lines.find(l => l.startsWith("Question:"))?.replace("Question:", "").trim();

//     const options = ["A)", "B)", "C)", "D)"].map(label => {
//       const line = lines.find(l => l.startsWith(label));
//       return line ? line.replace(label, "").trim() : null;
//     });

//     const correctAnswer = lines.find(l => l.startsWith("Correct Answer:"))
//       ?.replace("Correct Answer:", "")
//       .trim()
//       .charAt(0);

//     if (!question || options.includes(null) || !correctAnswer) {
//       return res.status(500).json({
//         error: "Invalid AI format",
//         raw: text
//       });
//     }

//     res.json({ question, options, correctAnswer });

//   } catch (error) {
//     console.error("Gemini Error:", error.response?.data || error);
//     res.status(500).json({ error: "Internal Server Error", details: error.response?.data });
//   }
// });


// Update the student's score
app.post('/result', async (req, res) => {
  const { code, rollno, score } = req.body;
  const Code = mongoose.model(code, studentSchema);
  try {
    // Find the document by rollno
    const existingCode = await Code.findOne({ rollNumber: rollno });
    console.log(existingCode);
    if (!existingCode) {
      return res.status(404).json({ message: 'Code not found' });
    }

    // Update the marks with the new score
    existingCode.marks = score;

    // Save the updated document
    await existingCode.save();
    console.log(existingCode);
    res.status(200).json({ message: 'Marks updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Search collections by name
app.post('/searchCollections', async (req, res) => {
  try {
    const searchText = req.body.searchText;
    console.log('Search text:', searchText);
    const ne = mongoose.model(searchText, studentSchema);
    const collectionData = await fetchCollectionData(ne);
    console.log(collectionData);

    res.json(collectionData);
  } catch (error) {
    console.error('Error searching collections:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Function to fetch collection data from MongoDB
async function fetchCollectionData(collectionModel) {
  try {
    if (typeof collectionModel.find !== 'function') {
      throw new Error('Invalid MongoDB model');
    }

    const collectionData = await collectionModel.find({}).exec();
    return collectionData;
  } catch (error) {
    console.error('Error fetching collection data:', error);
    throw error;
  }
}

// Login route
app.post('/addlogin', async (req, res) => {
  try {
    const { username, password } = req.body.logindata;
    console.log(req.body.logindata);
    const user = await usermodel.findOne({ username, password });
    console.log(user);
    if (user) {
      return res.json({ msg: "Login successful" });
    } else {
      return res.status(401).json({ error: "Invalid username or password" });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Signup route
app.post('/addsignin', async (req, res) => {
  try {
    const { username, password, email } = req.body.signindata;
    const existingUser = await usermodel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists. Please use a different email address." });
    }
    const newUser = new usermodel({ username, password, email });
    await newUser.save();
    res.json({ msg: "User signed up successfully" });
  }
  catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
