// ==============================================================================
// SERVIDOR PROFISSIONAL - CLÍNICA DRA. YASMIN
// Sistema de Anamnese, Prontuários Eletrônicos, Exames e Agendamentos
// ==============================================================================

import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_dra_yasmin_super_segura_2026';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dev:dev123@cluster0.oflxvxo.mongodb.net/clinica_yasmin?retryWrites=true&w=majority&appName=Cluster0';

// ==============================================================================
// 🔥 CONFIGURAÇÃO ROBUSTA DE CORS
// Suporta: Localhost (3000, 5000, 5173), Render, GitHub Pages, Vercel, Netlify
// ==============================================================================

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
  'https://lleonardomarques.github.io',
  'https://lLeonardoMarques.github.io',
  'https://clinica-frontend.vercel.app',
  'https://clinica-frontend.netlify.app',
  'https://servidor-clinica-yasmin.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.endsWith('.github.io') ||
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`📡 [${req.method}] ${req.url} - Origin: ${req.headers.origin || 'local'}`);
  }
  next();
});

// ==============================================================================
// MODELOS & SCHEMAS DO MONGODB
// ==============================================================================

const ExamSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Laboratorial', 'Imagem (Raio-X, RM, TC)', 'Ultrassom', 'Laudo Médico', 'Outro'],
    default: 'Laudo Médico' 
  },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, default: 'application/pdf' },
  fileSize: { type: String, default: '' },
  notes: { type: String, default: '' },
  uploadedBy: { type: String, enum: ['DOCTOR', 'PATIENT'], default: 'DOCTOR' },
  uploadedByName: { type: String, default: 'Dra. Yasmin Oliveira' },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['DOCTOR', 'PATIENT'], default: 'PATIENT' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const PatientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  birthDate: { type: String, default: '' },
  gender: { type: String, enum: ['Feminino', 'Masculino', 'Outro'], default: 'Feminino' },
  occupation: { type: String, default: '' },
  emergencyContact: { type: String, default: '' },
  emergencyPhone: { type: String, default: '' },
  address: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['ativo', 'inativo', 'retorno_pendente', 'aguardando_aprovacao'], 
    default: 'aguardando_aprovacao' 
  },
  treatmentType: { type: String, default: 'Massoterapia e Estética Corporal' },
  notes: { type: String, default: '' },
  totalSessions: { type: Number, default: 0 },
  lastVisit: { type: String, default: '' },
  exams: [ExamSchema],
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Patient = mongoose.model('Patient', PatientSchema);

const QuestionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
  label: { type: String, required: true },
  subtitle: { type: String, default: '' },
  type: { 
    type: String, 
    enum: ['text', 'textarea', 'radio', 'checkbox', 'select', 'scale', 'body_map', 'boolean'],
    default: 'radio' 
  },
  options: [{
    label: String,
    value: String,
    isContraindication: { type: Boolean, default: false }
  }],
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  isAlertTrigger: { type: Boolean, default: false },
  alertMessage: { type: String, default: '' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Question = mongoose.model('Question', QuestionSchema);

const AnamnesisSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorName: { type: String, default: 'Dra. Yasmin Oliveira' },
  pressurePreference: { 
    type: String, 
    enum: ['Suave / Relaxante', 'Média / Terapêutica', 'Firme / Profunda', 'Vigorosa / Modeladora'],
    default: 'Média / Terapêutica' 
  },
  mainObjective: { type: String, required: true },
  bodyAreas: [{
    id: String,
    name: String,
    type: String,
    intensity: Number
  }],
  answers: { type: mongoose.Schema.Types.Mixed, required: true },
  detectedAlerts: [String],
  clinicalObservations: { type: String, default: '' },
  recommendedTechniques: [String],
  exams: [ExamSchema],
  status: { type: String, enum: ['concluido', 'em_andamento'], default: 'concluido' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Anamnesis = mongoose.model('Anamnesis', AnamnesisSchema);

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patientName: { type: String, required: true },
  patientEmail: { type: String, default: '' },
  patientPhone: { type: String, required: true },
  service: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['agendado', 'confirmado', 'realizado', 'cancelado'], 
    default: 'agendado' 
  },
  notes: { type: String, default: '' },
  doctorName: { type: String, default: 'Dra. Yasmin Oliveira' },
  createdAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// ==============================================================================
// CONEXÃO RESILIENTE COM O MONGODB
// ==============================================================================

async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Conectado com sucesso ao MongoDB Atlas');
    await createDefaultDoctor();
    await seedDefaultQuestionsIfEmpty();
    console.log('📋 Sistema pronto e perguntas clínicas carregadas');
  } catch (err) {
    console.warn('⚠️ Atenção na conexão MongoDB:', err.message);
    console.warn('O servidor continuará operando para manter rotas e pré-visualização ativas.');
  }
}

connectMongo();

// ==============================================================================
// MIDDLEWARES DE AUTORIZAÇÃO
// ==============================================================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = decoded;
    next();
  });
}

function requireDoctor(req, res, next) {
  if (req.user && req.user.role === 'DOCTOR') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado: Exclusivo para Dra. Yasmin' });
  }
}

// ==============================================================================
// 1. ROTAS DE AUTENTICAÇÃO (/api/auth)
// ==============================================================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Nome, e-mail, telefone e senha são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'E-mail já cadastrado no sistema. Por favor, faça login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';
    const existingPatient = await Patient.findOne({ email: cleanEmail });
    const isAutoApproved = assignedRole === 'DOCTOR' || !!existingPatient;

    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: assignedRole,
      status: isAutoApproved ? 'approved' : 'pending',
      isApproved: isAutoApproved
    });

    let patientRecord = null;

    if (assignedRole === 'PATIENT') {
      if (existingPatient) {
        existingPatient.userId = newUser._id;
        existingPatient.status = 'ativo';
        await existingPatient.save();
        patientRecord = existingPatient;
        console.log(`🔗 Paciente existente vinculado e aprovado automaticamente: ${cleanEmail}`);
      } else {
        patientRecord = await Patient.create({
          userId: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          status: 'aguardando_aprovacao',
          treatmentType: 'Massoterapia e Estética Corporal'
        });
        console.log(`⏳ Novo cadastro pendente de aprovação pela Dra. Yasmin: ${cleanEmail}`);
      }
    }

    if (isAutoApproved) {
      const token = jwt.sign(
        { id: newUser._id.toString(), role: newUser.role, email: newUser.email, status: newUser.status, name: newUser.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        success: true,
        autoApproved: true,
        message: existingPatient 
          ? 'Cadastro aprovado! Sua ficha clínica foi vinculada com sucesso.'
          : 'Cadastro realizado com sucesso!',
        token,
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          isApproved: newUser.isApproved
        },
        patient: patientRecord,
        isExistingPatient: !!existingPatient
      });
    }

    return res.status(201).json({
      success: true,
      autoApproved: false,
      requiresApproval: true,
      message: 'Cadastro realizado com sucesso! Como seu e-mail ainda não constava na base clínica da Dra. Yasmin, seu cadastro foi enviado para aprovação da doutora antes da liberação do acesso.',
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        status: newUser.status,
        isApproved: newUser.isApproved
      },
      patient: patientRecord,
      isExistingPatient: false
    });

  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao cadastrar usuário' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'E-mail não cadastrado. Verifique a digitação ou crie sua conta na opção "Novo Usuário".',
        code: 'EMAIL_NOT_FOUND' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        error: 'Senha incorreta. Verifique os dados digitados e tente novamente.',
        code: 'INVALID_PASSWORD' 
      });
    }

    if (user.role === 'PATIENT' && (user.status === 'pending' || !user.isApproved)) {
      return res.status(403).json({ 
        error: 'Seu cadastro está pendente de aprovação pela Dra. Yasmin. Aguarde a liberação do seu acesso pela administração da clínica.',
        status: 'pending',
        code: 'ACCOUNT_PENDING'
      });
    }

    if (user.role === 'PATIENT' && user.status === 'rejected') {
      return res.status(403).json({ 
        error: 'Seu cadastro não foi aprovado pela administração da clínica.',
        status: user.status,
        code: 'ACCOUNT_REJECTED'
      });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, email: user.email, status: user.status, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isApproved: user.isApproved
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao realizar login' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isApproved: user.isApproved
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 2. ROTAS DE USUÁRIOS NO MONGO (/api/users)
// ==============================================================================

app.get('/api/users', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { role, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({
      success: true,
      total: users.length,
      users: users.map(u => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        isApproved: u.isApproved,
        createdAt: u.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'Usuário com este e-mail já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const existingPatient = await Patient.findOne({ email: cleanEmail });

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: (phone || '').trim(),
      password: hashedPassword,
      role: role || 'PATIENT',
      status: existingPatient ? 'approved' : 'pending',
      isApproved: !!existingPatient
    });

    if (existingPatient) {
      existingPatient.userId = user._id;
      await existingPatient.save();
    }

    res.status(201).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isApproved: user.isApproved,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { name, phone, role, status, isApproved } = req.body;
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    await Patient.findOneAndUpdate(
      { email: user.email },
      { 
        status: user.isApproved ? 'ativo' : 'aguardando_aprovacao',
        name: user.name,
        phone: user.phone
      }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ success: true, message: 'Usuário removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 3. ROTAS DE PACIENTES NO MONGO (/api/patients) - CORRIGIDAS
// ==============================================================================

// 🔥 LISTAR PACIENTES (CORRIGIDO: Retorna TODOS, incluindo pendentes)
app.get('/api/patients', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { search, treatmentType, status } = req.query;
    const filter = {};

    // 🔥 CORREÇÃO: Só filtra por status se for passado na query
    if (status && status !== 'todos' && status !== 'all') {
      filter.status = status;
    }
    // Se NÃO passou status, retorna TODOS (incluindo pendentes)

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (treatmentType) filter.treatmentType = treatmentType;

    console.log('🔍 Filtro aplicado em /patients:', filter);

    const patients = await Patient.find(filter).sort({ createdAt: -1 });
    
    console.log(`📋 Encontrados ${patients.length} pacientes`);

    const patientsFormatted = patients.map(p => ({
      id: p._id.toString(),
      userId: p.userId ? p.userId.toString() : null,
      name: p.name || 'Sem nome',
      email: p.email || '',
      phone: p.phone || '',
      birthDate: p.birthDate || '',
      gender: p.gender || 'Feminino',
      occupation: p.occupation || '',
      emergencyContact: p.emergencyContact || '',
      emergencyPhone: p.emergencyPhone || '',
      address: p.address || '',
      status: p.status || 'ativo',
      approvedBy: p.approvedBy ? p.approvedBy.toString() : null,
      approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
      treatmentType: p.treatmentType || 'Massoterapia e Estética Corporal',
      notes: p.notes || '',
      totalSessions: p.totalSessions || 0,
      lastVisit: p.lastVisit || '',
      exams: p.exams || [],
      createdAt: p.createdAt ? p.createdAt.toISOString().split('T')[0] : ''
    }));

    res.json({ 
      success: true, 
      total: patientsFormatted.length, 
      patients: patientsFormatted 
    });
  } catch (err) {
    console.error('❌ Erro em /patients:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// CRIAR PACIENTE PELA DOUTORA
app.post('/api/patients', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { 
      name, email, phone, birthDate, gender, occupation, 
      emergencyContact, emergencyPhone, address, treatmentType, notes 
    } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Nome, e-mail e telefone são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    const existingPatient = await Patient.findOne({ email: cleanEmail });
    if (existingPatient) {
      return res.status(400).json({ error: 'Já existe um paciente cadastrado com este e-mail' });
    }

    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      const defaultHash = await bcrypt.hash('123456', 10);
      user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        password: defaultHash,
        role: 'PATIENT',
        status: 'approved',
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date()
      });
      console.log(`👤 Usuário gerado automaticamente para o paciente: ${cleanEmail}`);
    } else {
      user.status = 'approved';
      user.isApproved = true;
      await user.save();
      console.log(`🔗 Amarrado ao usuário pré-existente: ${cleanEmail}`);
    }

    const patient = await Patient.create({
      userId: user._id,
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      birthDate: birthDate || '',
      gender: gender || 'Feminino',
      occupation: occupation || '',
      emergencyContact: emergencyContact || '',
      emergencyPhone: emergencyPhone || '',
      address: address || '',
      treatmentType: treatmentType || 'Massoterapia e Estética Corporal',
      notes: notes || '',
      status: 'ativo',
      totalSessions: 0,
      exams: [],
      approvedBy: req.user.id,
      approvedAt: new Date()
    });

    res.status(201).json({
      success: true,
      patient: {
        id: patient._id.toString(),
        userId: patient.userId?.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        gender: patient.gender,
        occupation: patient.occupation,
        emergencyContact: patient.emergencyContact,
        emergencyPhone: patient.emergencyPhone,
        address: patient.address,
        status: patient.status,
        treatmentType: patient.treatmentType,
        notes: patient.notes,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit,
        exams: patient.exams || [],
        createdAt: patient.createdAt ? patient.createdAt.toISOString().split('T')[0] : ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:id', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const anamneses = await Anamnesis.find({ patientId: patient._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      patient: {
        id: patient._id.toString(),
        userId: patient.userId?.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        gender: patient.gender,
        occupation: patient.occupation,
        emergencyContact: patient.emergencyContact,
        emergencyPhone: patient.emergencyPhone,
        address: patient.address,
        status: patient.status,
        treatmentType: patient.treatmentType,
        notes: patient.notes,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit,
        exams: patient.exams || [],
        createdAt: patient.createdAt ? patient.createdAt.toISOString().split('T')[0] : ''
      },
      anamneses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/patients/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { 
      name, email, phone, birthDate, gender, occupation, 
      emergencyContact, emergencyPhone, address, treatmentType, notes, status, totalSessions, lastVisit 
    } = req.body;

    const updateData = { updatedAt: new Date() };
    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (birthDate !== undefined) updateData.birthDate = birthDate;
    if (gender) updateData.gender = gender;
    if (occupation !== undefined) updateData.occupation = occupation;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (emergencyPhone !== undefined) updateData.emergencyPhone = emergencyPhone;
    if (address !== undefined) updateData.address = address;
    if (treatmentType) updateData.treatmentType = treatmentType;
    if (notes !== undefined) updateData.notes = notes;
    if (status) updateData.status = status;
    if (totalSessions !== undefined) updateData.totalSessions = totalSessions;
    if (lastVisit !== undefined) updateData.lastVisit = lastVisit;

    const patient = await Patient.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    if (patient.userId) {
      await User.findByIdAndUpdate(patient.userId, {
        name: patient.name,
        phone: patient.phone
      });
    }

    res.json({
      success: true,
      message: 'Ficha do paciente atualizada com sucesso',
      patient: {
        id: patient._id.toString(),
        userId: patient.userId?.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        gender: patient.gender,
        occupation: patient.occupation,
        emergencyContact: patient.emergencyContact,
        emergencyPhone: patient.emergencyPhone,
        address: patient.address,
        status: patient.status,
        treatmentType: patient.treatmentType,
        notes: patient.notes,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit,
        exams: patient.exams || [],
        createdAt: patient.createdAt ? patient.createdAt.toISOString().split('T')[0] : ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/patients/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    await Anamnesis.deleteMany({ patientId: patient._id });
    await Appointment.deleteMany({ patientId: patient._id });

    if (patient.userId) {
      await User.findByIdAndDelete(patient.userId);
    }

    await Patient.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Paciente removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/me', authMiddleware, async (req, res) => {
  try {
    let patient = await Patient.findOne({
      $or: [
        { userId: req.user.id },
        { email: req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Ficha de paciente não encontrada para este usuário' });
    }

    if (!patient.userId) {
      patient.userId = req.user.id;
      await patient.save();
    }

    res.json({
      success: true,
      patient: {
        id: patient._id.toString(),
        userId: patient.userId?.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        gender: patient.gender,
        occupation: patient.occupation,
        emergencyContact: patient.emergencyContact,
        emergencyPhone: patient.emergencyPhone,
        address: patient.address,
        status: patient.status,
        treatmentType: patient.treatmentType,
        notes: patient.notes,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit,
        exams: patient.exams || [],
        createdAt: patient.createdAt ? patient.createdAt.toISOString().split('T')[0] : ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 PACIENTES PENDENTES DE APROVAÇÃO (CORRIGIDO: Tratamento de erro robusto)
app.get('/api/patients/pending', authMiddleware, requireDoctor, async (req, res) => {
  try {
    console.log('📤 Buscando pacientes pendentes...');
    
    // Busca pacientes com status pendente ou aguardando aprovação
    const pendingPatients = await Patient.find({ 
      status: { $in: ['aguardando_aprovacao', 'pending'] } 
    }).sort({ createdAt: -1 });
    
    // Busca também usuários com role PATIENT que ainda estão pendentes
    const pendingUsers = await User.find({
      role: 'PATIENT',
      $or: [{ status: 'pending' }, { isApproved: false }]
    }).select('-password');

    // Mapeia emails já presentes
    const existingEmails = new Set(pendingPatients.map(p => (p.email || '').toLowerCase().trim()));

    // Adiciona fichas de usuários que ainda não tenham ficha de paciente correspondente
    for (const u of pendingUsers) {
      const uEmail = (u.email || '').toLowerCase().trim();
      if (!existingEmails.has(uEmail)) {
        let pat = await Patient.findOne({ $or: [{ userId: u._id }, { email: uEmail }] });
        if (!pat) {
          pat = await Patient.create({
            userId: u._id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            status: 'aguardando_aprovacao',
            treatmentType: 'Massoterapia e Estética Corporal'
          });
        }
        if (pat && (pat.status === 'aguardando_aprovacao' || pat.status === 'pending')) {
          pendingPatients.push(pat);
          existingEmails.add(uEmail);
        }
      }
    }
    
    console.log(`📋 Encontrados ${pendingPatients.length} pacientes pendentes`);
    
    if (pendingPatients.length === 0) {
      return res.json({ 
        success: true, 
        total: 0,
        patients: [] 
      });
    }
    
    const patientsWithUsers = await Promise.all(pendingPatients.map(async (p) => {
      try {
        let userData = null;
        
        if (p.userId) {
          try {
            const user = await User.findById(p.userId).select('-password');
            if (user) {
              userData = {
                id: user._id.toString(),
                name: user.name || 'Usuário sem nome',
                email: user.email || '',
                phone: user.phone || '',
                status: user.status || 'pending'
              };
            }
          } catch (userErr) {
            console.warn(`⚠️ Erro ao buscar usuário:`, userErr.message);
          }
        } else if (p.email) {
          try {
            const user = await User.findOne({ email: p.email.toLowerCase().trim() }).select('-password');
            if (user) {
              userData = {
                id: user._id.toString(),
                name: user.name || 'Usuário sem nome',
                email: user.email || '',
                phone: user.phone || '',
                status: user.status || 'pending'
              };
            }
          } catch (userErr) {
            console.warn(`⚠️ Erro ao buscar usuário por email:`, userErr.message);
          }
        }
        
        return {
          id: p._id.toString(),
          userId: p.userId ? p.userId.toString() : (userData?.id || null),
          name: p.name || 'Nome não informado',
          email: p.email || '',
          phone: p.phone || '',
          status: p.status || 'aguardando_aprovacao',
          treatmentType: p.treatmentType || 'Massoterapia e Estética Corporal',
          exams: p.exams || [],
          createdAt: p.createdAt || new Date(),
          user: userData
        };
      } catch (err) {
        console.error('❌ Erro ao processar paciente:', err.message);
        return {
          id: p._id ? p._id.toString() : 'erro',
          name: p.name || 'Erro ao carregar',
          email: p.email || '',
          phone: p.phone || '',
          status: 'erro',
          error: err.message
        };
      }
    }));
    
    res.json({ 
      success: true, 
      total: patientsWithUsers.length,
      patients: patientsWithUsers 
    });
    
  } catch (err) {
    console.error('❌ ERRO CRÍTICO em /patients/pending:', err.message);
    console.error('Stack:', err.stack);
    
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar pacientes pendentes',
      details: err.message
    });
  }
});

// LISTA DE USUÁRIOS PENDENTES
app.get('/api/users/pending', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const pendingUsers = await User.find({
      $or: [{ status: 'pending' }, { isApproved: false }],
      role: 'PATIENT'
    }).select('-password').sort({ createdAt: -1 });

    const formatted = await Promise.all(pendingUsers.map(async (u) => {
      const patient = await Patient.findOne({ $or: [{ userId: u._id }, { email: u.email }] });
      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        isApproved: u.isApproved,
        createdAt: u.createdAt,
        patientId: patient ? patient._id.toString() : null,
        patientStatus: patient ? patient.status : null
      };
    }));

    res.json({ success: true, count: formatted.length, users: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// APROVAR PACIENTE
app.post('/api/patients/approve/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    
    let patient = null;
    try {
      patient = await Patient.findById(id);
    } catch (e) {
      // id might not be ObjectId
    }
    if (!patient) {
      patient = await Patient.findOne({ userId: id });
    }

    let user = null;
    if (patient?.userId) {
      try {
        user = await User.findById(patient.userId);
      } catch (e) {}
    }
    if (!user) {
      try {
        user = await User.findById(id);
      } catch (e) {}
    }
    if (!user && patient?.email) {
      user = await User.findOne({ email: patient.email.toLowerCase().trim() });
    }
    if (!patient && user) {
      patient = await Patient.findOne({ $or: [{ userId: user._id }, { email: user.email.toLowerCase().trim() }] });
    }

    if (!patient && !user) {
      return res.status(404).json({ error: 'Cadastro não encontrado para aprovação' });
    }

    if (patient) {
      patient.status = 'ativo';
      patient.approvedBy = req.user.id;
      patient.approvedAt = new Date();
      if (user && !patient.userId) {
        patient.userId = user._id;
      }
      await patient.save();
    }

    if (user) {
      user.status = 'approved';
      user.isApproved = true;
      user.approvedBy = req.user.id;
      user.approvedAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: 'Paciente e usuário aprovados com sucesso! O acesso ao sistema está liberado.',
      patient: patient ? {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        status: patient.status
      } : null,
      user: user ? {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        status: user.status
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/approve', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    user.status = 'approved';
    user.isApproved = true;
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    await user.save();

    const patient = await Patient.findOneAndUpdate(
      { $or: [{ userId: user._id }, { email: user.email }] },
      { 
        status: 'ativo', 
        userId: user._id,
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Usuário aprovado com sucesso!',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        status: user.status
      },
      patient: patient ? {
        id: patient._id.toString(),
        name: patient.name,
        status: patient.status
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/reject', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    user.status = 'rejected';
    user.isApproved = false;
    await user.save();

    await Patient.findOneAndUpdate(
      { $or: [{ userId: user._id }, { email: user.email }] },
      { status: 'inativo' }
    );

    res.json({ success: true, message: 'Usuário recusado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients/reject/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    let patient = await Patient.findById(id);
    if (!patient) {
      patient = await Patient.findOne({ userId: id });
    }

    if (patient) {
      patient.status = 'inativo';
      await patient.save();

      if (patient.userId) {
        await User.findByIdAndUpdate(patient.userId, {
          status: 'rejected',
          isApproved: false
        });
      }
    } else {
      await User.findByIdAndUpdate(id, {
        status: 'rejected',
        isApproved: false
      });
    }

    res.json({ success: true, message: 'Cadastro recusado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients/link', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { email, patientId, userId } = req.body;
    if (!email || !patientId || !userId) {
      return res.status(400).json({ error: 'E-mail, patientId e userId são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingPatient = await Patient.findOne({ email: cleanEmail, _id: { $ne: patientId } });
    if (!existingPatient) {
      return res.status(404).json({ error: 'Ficha existente não encontrada para este e-mail' });
    }

    const pendingUser = await User.findById(userId);
    if (!pendingUser) return res.status(404).json({ error: 'Usuário não encontrado' });

    existingPatient.userId = pendingUser._id;
    existingPatient.status = 'ativo';
    existingPatient.approvedBy = req.user.id;
    existingPatient.approvedAt = new Date();
    await existingPatient.save();

    pendingUser.status = 'approved';
    pendingUser.isApproved = true;
    pendingUser.approvedBy = req.user.id;
    pendingUser.approvedAt = new Date();
    await pendingUser.save();

    await Patient.findByIdAndDelete(patientId);
    await Anamnesis.updateMany({ patientId: patientId }, { patientId: existingPatient._id });
    await Appointment.updateMany({ patientId: patientId }, { patientId: existingPatient._id });

    res.json({
      success: true,
      message: 'Paciente vinculado e unificado com sucesso!',
      linkedPatient: {
        id: existingPatient._id.toString(),
        name: existingPatient.name,
        email: existingPatient.email,
        status: existingPatient.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 4. ROTAS DE ANEXAR EXAMES
// ==============================================================================

app.post('/api/patients/:id/exams', authMiddleware, async (req, res) => {
  try {
    const { title, category, date, fileUrl, fileName, fileType, fileSize, notes } = req.body;

    if (!title || !fileUrl || !fileName) {
      return res.status(400).json({ error: 'Título do exame, arquivo e nome do arquivo são obrigatórios' });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const newExam = {
      title: title.trim(),
      category: category || 'Laudo Médico',
      date: date || new Date().toISOString().split('T')[0],
      fileUrl,
      fileName,
      fileType: fileType || 'application/pdf',
      fileSize: fileSize || '',
      notes: notes || '',
      uploadedBy: req.user.role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT',
      uploadedByName: req.user.name || (req.user.role === 'DOCTOR' ? 'Dra. Yasmin Oliveira' : patient.name),
      createdAt: new Date()
    };

    patient.exams.push(newExam);
    await patient.save();

    const addedExam = patient.exams[patient.exams.length - 1];

    console.log(`📎 Exame anexado para ${patient.name}: ${newExam.title}`);

    res.status(201).json({
      success: true,
      message: 'Exame anexado com sucesso',
      exam: addedExam,
      exams: patient.exams
    });
  } catch (err) {
    console.error('Erro ao anexar exame:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/patients/:id/exams', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });
    res.json({ success: true, exams: patient.exams || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/patients/:id/exams/:examId', authMiddleware, async (req, res) => {
  try {
    const { id, examId } = req.params;
    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    patient.exams = patient.exams.filter(ex => ex._id.toString() !== examId);
    await patient.save();

    res.json({ success: true, message: 'Exame removido com sucesso', exams: patient.exams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients/me/exams', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [
        { userId: req.user.id },
        { email: req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!patient) return res.status(404).json({ error: 'Ficha do paciente não encontrada' });

    const { title, category, date, fileUrl, fileName, fileType, fileSize, notes } = req.body;
    if (!title || !fileUrl || !fileName) {
      return res.status(400).json({ error: 'Título do exame e arquivo são obrigatórios' });
    }

    const newExam = {
      title: title.trim(),
      category: category || 'Outro',
      date: date || new Date().toISOString().split('T')[0],
      fileUrl,
      fileName,
      fileType: fileType || 'application/pdf',
      fileSize: fileSize || '',
      notes: notes || '',
      uploadedBy: 'PATIENT',
      uploadedByName: req.user.name || patient.name,
      createdAt: new Date()
    };

    patient.exams.push(newExam);
    await patient.save();

    res.status(201).json({
      success: true,
      message: 'Exame enviado com sucesso para a Dra. Yasmin',
      exam: patient.exams[patient.exams.length - 1],
      exams: patient.exams
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 5. ROTAS DE PERGUNTAS NO BANCO (/api/questions)
// ==============================================================================

app.get('/api/questions', async (req, res) => {
  try {
    let questions = await Question.find().sort({ order: 1, createdAt: 1 });
    if (questions.length === 0) {
      await seedDefaultQuestionsIfEmpty();
      questions = await Question.find().sort({ order: 1, createdAt: 1 });
    }

    res.json({
      success: true,
      total: questions.length,
      questions: questions.map(q => ({
        id: q.id,
        categoryId: q.categoryId,
        label: q.label,
        subtitle: q.subtitle,
        type: q.type,
        options: q.options,
        placeholder: q.placeholder,
        required: q.required,
        isAlertTrigger: q.isAlertTrigger,
        alertMessage: q.alertMessage
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id, categoryId, label, subtitle, type, options, placeholder, required, isAlertTrigger, alertMessage } = req.body;

    if (!label || !categoryId) {
      return res.status(400).json({ error: 'Título da pergunta e categoria são obrigatórios' });
    }

    const questionId = id || `q_${Date.now()}`;
    const question = await Question.create({
      id: questionId,
      categoryId,
      label: label.trim(),
      subtitle: subtitle || '',
      type: type || 'radio',
      options: options || [],
      placeholder: placeholder || '',
      required: !!required,
      isAlertTrigger: !!isAlertTrigger,
      alertMessage: alertMessage || '',
      order: await Question.countDocuments() + 1
    });

    res.status(201).json({ success: true, question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/questions/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const question = await Question.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!question) return res.status(404).json({ error: 'Pergunta não encontrada' });
    res.json({ success: true, question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/questions/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const question = await Question.findOneAndDelete({ id: req.params.id });
    if (!question) return res.status(404).json({ error: 'Pergunta não encontrada' });
    res.json({ success: true, message: 'Pergunta removida com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions/seed', authMiddleware, requireDoctor, async (req, res) => {
  try {
    await Question.deleteMany({});
    await seedDefaultQuestionsIfEmpty(true);
    const questions = await Question.find().sort({ order: 1 });
    res.json({ success: true, message: 'Perguntas padrão redefinidas com sucesso', total: questions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 6. ROTAS DE FICHAS DE ANAMNESE (/api/anamnesis)
// ==============================================================================

app.post('/api/anamnesis', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { 
      patientId, doctorName, pressurePreference, mainObjective, 
      bodyAreas, answers, detectedAlerts, clinicalObservations, recommendedTechniques, exams 
    } = req.body;

    if (!patientId || !mainObjective || !answers) {
      return res.status(400).json({ error: 'Campos essenciais da anamnese não fornecidos' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const anamnesis = await Anamnesis.create({
      patientId,
      doctorName: doctorName || 'Dra. Yasmin Oliveira',
      pressurePreference: pressurePreference || 'Média / Terapêutica',
      mainObjective,
      bodyAreas: bodyAreas || [],
      answers,
      detectedAlerts: detectedAlerts || [],
      clinicalObservations: clinicalObservations || '',
      recommendedTechniques: recommendedTechniques || [],
      exams: exams || [],
      status: 'concluido'
    });
    
    await Patient.findByIdAndUpdate(patientId, {
      $inc: { totalSessions: 1 },
      lastVisit: new Date().toISOString().split('T')[0]
    });

    res.status(201).json({ 
      success: true, 
      message: 'Ficha de anamnese salva com sucesso no banco de dados',
      anamnesis: {
        id: anamnesis._id.toString(),
        patientId: anamnesis.patientId.toString(),
        doctorName: anamnesis.doctorName,
        pressurePreference: anamnesis.pressurePreference,
        mainObjective: anamnesis.mainObjective,
        bodyAreas: anamnesis.bodyAreas,
        answers: anamnesis.answers,
        detectedAlerts: anamnesis.detectedAlerts,
        clinicalObservations: anamnesis.clinicalObservations,
        recommendedTechniques: anamnesis.recommendedTechniques,
        status: anamnesis.status,
        createdAt: anamnesis.createdAt.toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anamnesis', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const rawRecords = await Anamnesis.find().sort({ createdAt: -1 });
    const records = rawRecords.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId.toString(),
      doctorName: a.doctorName,
      pressurePreference: a.pressurePreference,
      mainObjective: a.mainObjective,
      bodyAreas: a.bodyAreas,
      answers: a.answers,
      detectedAlerts: a.detectedAlerts,
      clinicalObservations: a.clinicalObservations,
      recommendedTechniques: a.recommendedTechniques,
      status: a.status,
      createdAt: a.createdAt.toISOString()
    }));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anamnesis/patient/:patientId', authMiddleware, async (req, res) => {
  try {
    const rawRecords = await Anamnesis.find({ patientId: req.params.patientId }).sort({ createdAt: -1 });
    const records = rawRecords.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId.toString(),
      doctorName: a.doctorName,
      pressurePreference: a.pressurePreference,
      mainObjective: a.mainObjective,
      bodyAreas: a.bodyAreas,
      answers: a.answers,
      detectedAlerts: a.detectedAlerts,
      clinicalObservations: a.clinicalObservations,
      recommendedTechniques: a.recommendedTechniques,
      status: a.status,
      createdAt: a.createdAt.toISOString()
    }));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/anamnesis/my', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [
        { userId: req.user.id },
        { email: req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!patient) {
      return res.json({ success: true, records: [] });
    }

    const rawRecords = await Anamnesis.find({ patientId: patient._id }).sort({ createdAt: -1 });
    const records = rawRecords.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId.toString(),
      doctorName: a.doctorName,
      pressurePreference: a.pressurePreference,
      mainObjective: a.mainObjective,
      bodyAreas: a.bodyAreas,
      answers: a.answers,
      detectedAlerts: a.detectedAlerts,
      clinicalObservations: a.clinicalObservations,
      recommendedTechniques: a.recommendedTechniques,
      status: a.status,
      createdAt: a.createdAt.toISOString()
    }));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 7. ROTAS DE AGENDAMENTO (/api/appointments)
// ==============================================================================

app.post('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const { patientId, service, date, time, notes } = req.body;
    let patient = null;

    if (patientId) {
      patient = await Patient.findById(patientId);
    }
    if (!patient && req.user?.email) {
      patient = await Patient.findOne({ email: req.user.email.toLowerCase().trim() });
    }

    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado para agendamento' });
    }

    if (patient.status === 'aguardando_aprovacao') {
      return res.status(403).json({ error: 'Cadastro aguardando aprovação para liberar agendamento.' });
    }

    const appointment = await Appointment.create({
      patientId: patient._id,
      patientName: patient.name,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      service: service || 'Massagem Relaxante com Aromaterapia',
      date,
      time,
      notes: notes || '',
      status: 'agendado'
    });

    res.status(201).json({ 
      success: true, 
      message: 'Consulta agendada com sucesso!',
      appointment: {
        id: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        patientName: appointment.patientName,
        patientPhone: appointment.patientPhone,
        service: appointment.service,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
        notes: appointment.notes,
        createdAt: appointment.createdAt ? appointment.createdAt.toISOString() : new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/appointments/my', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      $or: [
        { userId: req.user.id },
        { email: req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!patient) {
      return res.json({ success: true, appointments: [] });
    }

    const raw = await Appointment.find({ patientId: patient._id }).sort({ date: 1, time: 1 });
    const appointments = raw.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId.toString(),
      patientName: a.patientName,
      patientEmail: a.patientEmail || '',
      patientPhone: a.patientPhone,
      service: a.service,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes,
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString()
    }));
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/appointments', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const raw = await Appointment.find().sort({ date: 1, time: 1 });
    const appointments = raw.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId.toString(),
      patientName: a.patientName,
      patientEmail: a.patientEmail || '',
      patientPhone: a.patientPhone,
      service: a.service,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes,
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString()
    }));
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/appointments/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    res.json({
      success: true,
      appointment: {
        id: appointment._id.toString(),
        patientId: appointment.patientId.toString(),
        patientName: appointment.patientName,
        patientPhone: appointment.patientPhone,
        service: appointment.service,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
        notes: appointment.notes
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 8. HEALTH CHECK
// ==============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting/fallback',
    server: 'Clínica Dra. Yasmin - Servidor Completo em JS',
    targetDeployUrl: 'https://servidor-clinica-yasmin.onrender.com/api'
  });
});

// ==============================================================================
// FUNÇÕES AUXILIARES DE INICIALIZAÇÃO
// ==============================================================================

async function createDefaultDoctor() {
  try {
    const doctorExists = await User.findOne({ email: 'dra.yasmin@clinica.com' });
    
    if (!doctorExists) {
      const hashedPassword = await bcrypt.hash('adminPassword2026!', 10);
      
      await User.create({
        name: 'Dra. Yasmin Oliveira',
        email: 'dra.yasmin@clinica.com',
        phone: '(11) 99123-4567',
        password: hashedPassword,
        role: 'DOCTOR',
        status: 'approved',
        isApproved: true
      });
      
      console.log('✅ Dra. Yasmin criada com sucesso!');
      console.log('📧 Email: dra.yasmin@clinica.com | Senha: adminPassword2026!');
    }
  } catch (err) {
    console.warn('Nota ao verificar usuário padrão:', err.message);
  }
}

async function seedDefaultQuestionsIfEmpty(force = false) {
  try {
    const count = await Question.countDocuments();
    if (count > 0 && !force) return;

    const defaultQuestions = [
      {
        id: 'q_sono',
        categoryId: 'cat-habitos',
        label: 'Como você avalia a qualidade do seu sono?',
        subtitle: 'O sono afeta diretamente a recuperação muscular e tônus.',
        type: 'radio',
        options: [
          { label: 'Excelente (7 a 9h reparadoras)', value: 'excelente' },
          { label: 'Regular (acordo cansada / interrupções)', value: 'regular' },
          { label: 'Insônia frequente / sono agitado', value: 'insonia', isContraindication: false }
        ],
        required: true,
        order: 1
      },
      {
        id: 'q_estresse',
        categoryId: 'cat-habitos',
        label: 'Nível diário de estresse e ansiedade:',
        type: 'scale',
        options: [],
        required: true,
        order: 2
      },
      {
        id: 'q_contraindicacoes',
        categoryId: 'cat-saude',
        label: 'Possui alguma das seguintes condições clínicas?',
        subtitle: 'Indique para adequação segura dos protocolos e pressão.',
        type: 'checkbox',
        options: [
          { label: 'Trombose Venosa Profunda (TVP) ou Flebite ativa', value: 'trombose', isContraindication: true },
          { label: 'Gestação / Suspeita de gravidez', value: 'gravidez', isContraindication: true },
          { label: 'Hipertensão Arterial não controlada', value: 'hipertensao', isContraindication: true },
          { label: 'Processo infeccioso ou febre recente', value: 'febre', isContraindication: true },
          { label: 'Próteses metálicas, marcapasso ou pinos', value: 'proteses' },
          { label: 'Nenhuma das anteriores (Apto)', value: 'nenhuma' }
        ],
        required: true,
        isAlertTrigger: true,
        alertMessage: 'Atenção clínica necessária: condições vasculares e gestação exigem autorização médica prévia.',
        order: 3
      },
      {
        id: 'q_objetivo_massagem',
        categoryId: 'cat-queixas',
        label: 'Qual o seu principal objetivo na sessão de hoje?',
        type: 'radio',
        options: [
          { label: 'Alívio de dores musculares crônicas e nós de tensão', value: 'alivio_dor' },
          { label: 'Relaxamento profundo antiestresse e descanso', value: 'relaxamento' },
          { label: 'Redução de inchaço, retenção hídrica e toxinas (Drenagem)', value: 'drenagem' },
          { label: 'Estética corporal: celulite, firmeza e contorno', value: 'estetica' }
        ],
        required: true,
        order: 4
      },
      {
        id: 'q_alergias',
        categoryId: 'cat-saude',
        label: 'Possui alergia a óleos essenciais, cremes ou cosméticos?',
        type: 'radio',
        options: [
          { label: 'Não possuo alergias conhecidas', value: 'nao' },
          { label: 'Sim (especificar nas observações)', value: 'sim', isContraindication: true }
        ],
        required: true,
        order: 5
      }
    ];

    await Question.insertMany(defaultQuestions);
    console.log('✅ Perguntas clínicas padrão cadastradas no MongoDB');
  } catch (err) {
    console.warn('Nota ao semear perguntas:', err.message);
  }
}

// ==============================================================================
// INICIALIZAÇÃO DO SERVIDOR
// ==============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('⚡ Vite dev server montado com sucesso como middleware');
    } catch (err) {
      console.warn('⚠️ Vite dev middleware não inicializado:', err.message);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Dra. Yasmin rodando com sucesso na porta ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🌐 Alvo Produção: https://servidor-clinica-yasmin.onrender.com/api`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  });
}

startServer();