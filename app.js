const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
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

const key = "AIzaSyB3hLtxohmonVe_fNKSnOFnQMpDs8JSrIU";
const genAI = new GoogleGenerativeAI(key);

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
      Generate a multiple-choice quiz on the topic of "${topic}" with the following requirements:

      1. Generate a question related to ${topic} with difficulty level ${answered} out of ${maxque}.
      2. Provide four multiple-choice options for the question.
      3. Ensure one of the options is the correct answer.
      4. Do not repeat the same question.
      generate result in this formate dont add any speacia character before question,options,correct answers labels
      Question: ${topic}
      Options:
          A) [Option 1]
          B) [Option 2]
          C) [Option 3]
          D) [Option 4]

      Correct Answer: [Correct Option]
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([{ text: prompt }]);

    if (!result || !result.response) {
      throw new Error('No response from Google Gemini AI');
    }

    const resultText = result.response.text();
    console.log('Generated Content:', resultText);

    // Splitting by newlines and trimming whitespace
    const lines = resultText.split('\n').map(line => line.trim());

    // Extract the question line (after 'Question:')
    const questionLine = lines.find(line => line.startsWith('Question:'));
    const question = questionLine ? questionLine.replace('Question: ', '').trim() : null;

    // Find the index of the options and extract them
    const optionsStartIndex = lines.findIndex(line => line.startsWith('A)'));
    const options = lines.slice(optionsStartIndex, optionsStartIndex + 4)  // Assuming 4 options (A, B, C, D)
                          .map(line => {
                            const match = line.match(/^([A-D])\) (.+)$/);  // Regex to match 'A) Option'
                            return match ? match[2].trim() : null;
                          })
                          .filter(option => option !== null);

    // Extract the correct answer (after 'Correct Answer:')
    const correctAnswerLine = lines.find(line => line.startsWith('Correct Answer:'));
    const correctAnswer = correctAnswerLine.replace('Correct Answer: ', '').trim().charAt(0);

    // Ensure all parts are present
    if (!question || options.length !== 4 || !correctAnswer) {
      return res.status(500).json({ error: "Failed to generate a valid question format." });
    }

    // Send response in the desired format
    const questionResponse = {
      question,       // Question as the first line
      options,        // Four options
      correctAnswer   // Correct answer as a capital letter
    };

    console.log('Parsed Question Response:', questionResponse);
    res.send(questionResponse);

  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


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
