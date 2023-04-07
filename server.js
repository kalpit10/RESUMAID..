require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const dbConnect = require("./dbConnect");
const userRoute = require("./routes/userRoutes");
const ResumeParser = require("./resume-parser-master/src");
const Resume = require("./resume-parser-master/src/utils/Resume");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const path = require("path");
const College = require("./models/colleges");
const resumeData = require("./models/resume");
const compression = require("compression");

const app = express();

const port = process.env.PORT || 5000;

app.use(express.json());
// You can use app.use(express.urlencoded({ extended: true })) to parse URL-encoded request bodies.
app.use(express.urlencoded({ extended: true }));

app.use("/api/user/", userRoute);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://resumaid.herokuapp.com");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(compression());

app.use(function (req, res, next) {
  if (
    req.path === "/result" ||
    req.path === "/upload" ||
    req.path === "/colleges"
  ) {
    res.header("Content-Type", "application/json");
  }
  next();
});

//FOR DEPLOYMENT
if (process.env.NODE_ENV === "production") {
  app.use("/", express.static("client/build"));

  // for all the requests
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client/build/index.html"));
  });
}

app.set("view engine", "ejs");

//---------------MULTER UPLOAD SECTION-------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    //null(no errors), "destination"
    cb(null, "./resume-parser-master/resumeFiles/");
  },

  filename: (req, file, cb) => {
    console.log(file);
    //we extend and grab the name of the file
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

//single means single file, for multiple files we say upload.arrays
//upload.single("Input tag name to be passed in which you are uploading the file")
app.post("/upload", upload.single("File"), (req, res) => {
  ResumeParser.parseResumeFile(
    `./resume-parser-master/resumeFiles/${req.file.filename}`,
    `./resume-parser-master/resumeFiles/compiled`
  )
    .then((file) => {
      console.log("Yay! " + file);
      //we used readFileSync method because  we cannot require() a json file directly in node.
      const resumeJson = fs.readFileSync(
        `./resume-parser-master/resumeFiles/compiled/${req.file.filename}.json`
      );
      //parsing here is necessary because otherwise the content is shown in buffer type, console.log() to check it.
      const resume = JSON.parse(resumeJson);
      const resumeFile = new resumeData({
        name: resume.name || "",
        email: resume.email || "",
        skills: resume.skills || "",
        experience: resume.experience || "",
        education: resume.education || "",
        projects: resume.projects || "",
        interests: resume.interests || "",
        certifications: resume.certifications || "",
        objective: resume.objective || "",
        summary: resume.summary || "",
        technology: resume.technology || "",
        languages: resume.languages || "",
        links: resume.links || "",
        contacts: resume.contacts || "",
        positions: resume.positions || "",
        profiles: resume.profiles || "",
      });

      return resumeFile.save();
    })
    .then((savedResume) => {
      console.log("Resume saved to database:", savedResume);
      res.json({
        success: true,
        message: "File Uploaded and Parsed Successfully",
      });
    })
    .catch((error) => {
      console.log("parseResume failed");
      console.error(error);
      res.json({ success: false, message: "Error parsing uploaded file" });
    });
});

//this endpoint will send the latest json file to the score.js file in react and use that file's data
app.get("/result", (req, res) => {
  // Get the list of JSON files in the directory
  const dirPath = path.join(
    __dirname,
    "resume-parser-master",
    "resumeFiles",
    "compiled"
  );

  const files = fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".json"));

  // Sort the list of files by creation time in descending order
  files.sort((a, b) => {
    return (
      fs.statSync(path.join(dirPath, b)).ctimeMs -
      fs.statSync(path.join(dirPath, a)).ctimeMs
    );
  });

  // Get the latest file name
  const latestFile = files[0];

  // Read the JSON data from the latest file
  const jsonData = JSON.parse(
    fs.readFileSync(path.join(dirPath, latestFile), "utf-8")
  );

  // Send the JSON data as the response
  res.send(jsonData);
  console.log(jsonData);
});

//------------COLLEGE DATA----------------------

app.get("/colleges", async (req, res) => {
  try {
    //ONLY FINDING COLLEGES BY NAME
    const colleges = await College.find({}, { _id: 0, name: 1 }).sort({
      name: 1,
    });
    res.json(colleges);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
