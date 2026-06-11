const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const root = path.join(__dirname);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'students.json');

// Valid courses list
const VALID_COURSES = [
  'English / Icyongereza',
  'French / Igifaransa',
  'Chinese / Igishinwa',
  'Driving License',
  'Computer Skills',
  'Photography',
  'Videography',
  'Graphic Design'
];

// Initialize data directory
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database functions with error handling
function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({ students: [] }, null, 2));
    }
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Database read error:', err);
    return { students: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Database write error:', err);
    throw new Error('Failed to save data');
  }
}

// Validation helpers
function sanitize(str) {
  if (!str) return '';
  return String(str).trim().slice(0, 100);
}

function validateEmail(email) {
  if (!email) return true; // Email is optional
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePhone(phone) {
  // Accept various phone formats
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 9;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(root));

// ── API ROUTES ──────────────────────────────────

// Admin login
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'eduvision2026';

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Wrong username or password' });
  }
});

// Enrollment submission
app.post('/api/enroll', (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      age,
      gender,
      course,
      schedule,
      message
    } = req.body;

    // Validation
    const firstNameClean = sanitize(firstName);
    const lastNameClean = sanitize(lastName);
    const phoneClean = sanitize(phone);
    const emailClean = sanitize(email);

    if (!firstNameClean || !lastNameClean || !phoneClean || !course) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validatePhone(phoneClean)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (emailClean && !validateEmail(emailClean)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (!VALID_COURSES.includes(course)) {
      return res.status(400).json({ error: 'Invalid course selection' });
    }

    // Create student record
    const db = readDb();
    const id = db.students.length ? db.students[db.students.length - 1].id + 1 : 1;
    
    const student = {
      id,
      firstName: firstNameClean,
      lastName: lastNameClean,
      phone: phoneClean,
      email: emailClean,
      age: sanitize(age),
      gender: sanitize(gender),
      course,
      schedule: sanitize(schedule),
      message: sanitize(message),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      status: 'Pending'
    };

    db.students.push(student);
    writeDb(db);

    console.log(`✓ New enrollment: ${firstNameClean} ${lastNameClean} (${course})`);
    res.status(201).json(student);
  } catch (err) {
    console.error('Enrollment error:', err);
    res.status(500).json({ error: 'Unable to process enrollment' });
  }
});

// Get all students
app.get('/api/students', (req, res) => {
  try {
    const db = readDb();
    res.json(db.students.slice().reverse());
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch students' });
  }
});

// Confirm student enrollment
app.patch('/api/students/:id/confirm', (req, res) => {
  try {
    const db = readDb();
    const id = Number(req.params.id);
    
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const student = db.students.find(s => s.id === id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    student.status = 'Confirmed';
    student.confirmedDate = new Date().toLocaleDateString();
    writeDb(db);

    console.log(`✓ Confirmed: ${student.firstName} ${student.lastName}`);
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: 'Unable to confirm student' });
  }
});

// Delete student record
app.delete('/api/students/:id', (req, res) => {
  try {
    const db = readDb();
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const initialLength = db.students.length;
    db.students = db.students.filter(s => s.id !== id);

    if (db.students.length === initialLength) {
      return res.status(404).json({ error: 'Student not found' });
    }

    writeDb(db);
    console.log(`✓ Deleted: Student ID ${id}`);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Unable to delete student' });
  }
});

// Error handling for invalid routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
