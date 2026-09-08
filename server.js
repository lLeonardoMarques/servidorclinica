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

// Fail fast if database is unreachable, do not hang operations
mongoose.set('bufferCommands', false);

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
    // Permite requisições sem origin (como mobile apps, Postman, curl ou server-to-server)
    if (!origin) return callback(null, true);

    // Permite se estiver na lista explícita ou casar com padrões conhecidos
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
      // Por segurança mas sem quebrar integrações legítimas em dev/preview
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Suporte a preflight OPTIONS explícito
app.options('*', cors());

// Limite elevado para suportar anexos de exames médicos (PDFs e imagens em base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Log de requisições para auditoria e debug
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`📡 [${req.method}] ${req.url} - Origin: ${req.headers.origin || 'local'}`);
  }
  next();
});

// ==============================================================================
// MODELOS & SCHEMAS DO MONGODB
// ==============================================================================

// 1. Schema de Anexo de Exames
const ExamSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Laboratorial', 'Imagem (Raio-X, RM, TC)', 'Ultrassom', 'Laudo Médico', 'Outro'],
    default: 'Laudo Médico' 
  },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  fileUrl: { type: String, required: true }, // base64 DataURL ou link do arquivo
  fileName: { type: String, required: true },
  fileType: { type: String, default: 'application/pdf' },
  fileSize: { type: String, default: '' },
  notes: { type: String, default: '' },
  uploadedBy: { type: String, enum: ['DOCTOR', 'PATIENT'], default: 'DOCTOR' },
  uploadedByName: { type: String, default: 'Dra. Yasmin Oliveira' },
  createdAt: { type: Date, default: Date.now }
});

// 2. Schema de Usuário (autenticação & perfis)
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

// 3. Schema de Paciente (cadastro clínico & histórico)
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
  exams: [ExamSchema], // <- Suporte completo a anexos de exames
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Patient = mongoose.model('Patient', PatientSchema);

// 4. Schema de Perguntas da Anamnese (personalizáveis no banco)
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

// 5. Schema de Ficha de Anamnese
const AnamnesisSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: false },
  patientName: { type: String, default: '' },
  patientEmail: { type: String, default: '' },
  patientPhone: { type: String, default: '' },
  doctorName: { type: String, default: 'Dra. Yasmin Oliveira' },
  pressurePreference: { 
    type: String, 
    default: 'Média / Terapêutica' 
  },
  mainObjective: { type: String, default: 'Bem-estar e estética corporal' },
  bodyAreas: { type: [mongoose.Schema.Types.Mixed], default: [] },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  detectedAlerts: [String],
  clinicalObservations: { type: String, default: '' },
  recommendedTechniques: [String],
  exams: [ExamSchema],
  status: { type: String, enum: ['concluido', 'em_andamento'], default: 'concluido' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Anamnesis = mongoose.model('Anamnesis', AnamnesisSchema);

// 6. Schema de Agendamentos
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
    enum: ['pendente', 'agendado', 'confirmado', 'realizado', 'cancelado'], 
    default: 'pendente' 
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

// REGISTRO DE NOVO USUÁRIO
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Nome, e-mail, telefone e senha são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'E-mail já cadastrado no sistema' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';

    // AMARRAÇÃO AUTOMÁTICA POR E-MAIL E/OU TELEFONE:
    // Se o email e/ou telefone der match, vai direto pois trata-se de um paciente que a Dra. Yasmin já havia cadastrado
    const cleanPhone = (phone || '').trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '');

    let existingPatient = await Patient.findOne({ email: cleanEmail });

    if (!existingPatient && phoneDigits.length >= 8) {
      const allPatients = await Patient.find();
      existingPatient = allPatients.find(p => {
        const pDigits = (p.phone || '').replace(/\D/g, '');
        return pDigits.length >= 8 && (pDigits === phoneDigits || pDigits.endsWith(phoneDigits) || phoneDigits.endsWith(pDigits));
      });
    }

    const isMatch = !!existingPatient;
    const isAutoApproved = assignedRole === 'DOCTOR' || isMatch;

    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      role: assignedRole,
      status: isAutoApproved ? 'approved' : 'pending',
      isApproved: isAutoApproved
    });

    let patientRecord = null;

    if (assignedRole === 'PATIENT') {
      if (existingPatient) {
        // Vincula a ficha existente da Dra. ao novo usuário
        existingPatient.userId = newUser._id;
        existingPatient.status = 'ativo';
        if (!existingPatient.email) existingPatient.email = cleanEmail;
        if (!existingPatient.phone) existingPatient.phone = cleanPhone;
        await existingPatient.save();
        patientRecord = existingPatient;
        console.log(`🔗 MATCH CONFIRMADO! Paciente existente vinculado ao novo usuário: ${cleanEmail}`);
      } else {
        // Cria paciente aguardando aprovação da Dra. Yasmin
        patientRecord = await Patient.create({
          userId: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          status: 'aguardando_aprovacao',
          treatmentType: 'Massoterapia e Estética Corporal'
        });
        console.log(`⏳ NOVO USUÁRIO PENDENTE: aguardando aprovação da Dra. Yasmin: ${cleanEmail}`);
      }
    }

    const token = jwt.sign(
      { id: newUser._id.toString(), role: newUser.role, email: newUser.email, status: newUser.status, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      isMatch,
      message: isMatch 
        ? 'Pré-cadastro identificado! Seu acesso foi liberado com sucesso.'
        : 'Cadastro realizado com sucesso! Sua solicitação está aguardando aprovação da Dra. Yasmin.',
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
      isExistingPatient: isMatch
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao cadastrar usuário' });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (user.role === 'PATIENT' && user.status === 'rejected') {
      return res.status(403).json({ 
        error: 'Seu cadastro não foi aprovado pela administração.',
        status: user.status 
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

// DADOS DO USUÁRIO LOGADO
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
// Pessoas que cadastram novo usuário
// ==============================================================================

// LISTAR USUÁRIOS
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

// CRIAR NOVO USUÁRIO (pela Dra. ou endpoint REST)
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

// BUSCAR USUÁRIO POR ID
app.get('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ATUALIZAR USUÁRIO (status, aprovação, dados)
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

    // Sincroniza também no paciente se existir
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

// DELETAR USUÁRIO
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
// 3. ROTAS DE PACIENTES NO MONGO (/api/patients)
// Pacientes cadastrados pela Dra. Yasmin, com fichas, exames e amarração
// ==============================================================================

// LISTAR PACIENTES (Doutora)
app.get('/api/patients', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { search, treatmentType, status } = req.query;
    const filter = {};

    if (!status) {
      filter.status = { $ne: 'aguardando_aprovacao' };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (treatmentType) filter.treatmentType = treatmentType;
    if (status && status !== 'todos') filter.status = status;

    const patients = await Patient.find(filter).sort({ createdAt: -1 });

    const patientsFormatted = patients.map(p => ({
      id: p._id.toString(),
      userId: p.userId ? p.userId.toString() : null,
      name: p.name,
      email: p.email,
      phone: p.phone,
      birthDate: p.birthDate,
      gender: p.gender,
      occupation: p.occupation,
      emergencyContact: p.emergencyContact,
      emergencyPhone: p.emergencyPhone,
      address: p.address,
      status: p.status,
      treatmentType: p.treatmentType,
      notes: p.notes,
      totalSessions: p.totalSessions,
      lastVisit: p.lastVisit,
      exams: p.exams || [],
      createdAt: p.createdAt ? p.createdAt.toISOString().split('T')[0] : ''
    }));

    res.json({ success: true, total: patientsFormatted.length, patients: patientsFormatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRIAR PACIENTE PELA DOUTORA (Amarração automática com usuário pelo mesmo e-mail)
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

    // AMARRAÇÃO: Verifica se o usuário já havia criado conta com este e-mail
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      // Cria a conta do usuário para permitir login futuro pelo paciente
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
      // Se já existia conta de usuário, amarra e aprova
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

// BUSCAR PACIENTE POR ID (com exames e anamnese)
app.get('/api/patients/:id', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    // ISOLAMENTO DE DADOS: Apenas a doutora tem acesso total a tudo.
    // Pacientes só podem visualizar seus próprios dados.
    if (req.user.role !== 'DOCTOR') {
      const isSelf = (patient.userId && patient.userId.toString() === req.user.id) ||
                     (patient.email && patient.email.toLowerCase() === req.user.email?.toLowerCase());
      if (!isSelf) {
        return res.status(403).json({ error: 'Acesso negado: Você só pode visualizar seus próprios dados.' });
      }
    }

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

// ATUALIZAR PACIENTE PELA DOUTORA (Reflete imediatamente para o cliente)
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

    // Sincroniza nome e telefone no usuário amarrado
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

// DELETAR PACIENTE
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

// PERFIL DO PACIENTE LOGADO (/api/patients/me)
app.get('/api/patients/me', authMiddleware, async (req, res) => {
  try {
    // Procura por userId ou por email
    let patient = await Patient.findOne({
      $or: [
        { userId: req.user.id },
        { email: req.user.email?.toLowerCase().trim() }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Ficha de paciente não encontrada para este usuário' });
    }

    // Garante amarração mútua se ainda não estava gravada
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

// PACIENTES PENDENTES DE APROVAÇÃO
app.get('/api/patients/pending', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const pendingPatients = await Patient.find({ 
      status: 'aguardando_aprovacao' 
    }).sort({ createdAt: -1 });
    
    const patientsWithUsers = await Promise.all(pendingPatients.map(async (p) => {
      const user = await User.findById(p.userId).select('-password');
      return {
        id: p._id.toString(),
        userId: p.userId ? p.userId.toString() : null,
        name: p.name,
        email: p.email,
        phone: p.phone,
        status: p.status,
        treatmentType: p.treatmentType,
        exams: p.exams || [],
        createdAt: p.createdAt,
        user: user ? {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status
        } : null
      };
    }));
    
    res.json({ success: true, patients: patientsWithUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// APROVAR PACIENTE
app.post('/api/patients/approve/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    patient.status = 'ativo';
    patient.approvedBy = req.user.id;
    patient.approvedAt = new Date();
    await patient.save();

    if (patient.userId) {
      await User.findByIdAndUpdate(patient.userId, {
        status: 'approved',
        isApproved: true,
        approvedBy: req.user.id,
        approvedAt: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Paciente aprovado com sucesso!',
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        status: patient.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REJEITAR PACIENTE
app.post('/api/patients/reject/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    patient.status = 'inativo';
    await patient.save();

    if (patient.userId) {
      await User.findByIdAndUpdate(patient.userId, {
        status: 'rejected',
        isApproved: false
      });
    }

    res.json({ success: true, message: 'Paciente rejeitado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VINCULAR PACIENTE EXISTENTE MANUALMENTE
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
// 4. ROTAS DE ANEXAR EXAMES (/api/patients/:id/exams & /api/patients/me/exams)
// Suporte para a Doutora e para o Paciente anexarem laudos, imagens e exames
// ==============================================================================

// ANEXAR EXAME AO PACIENTE (Doutora ou Usuário autorizado)
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

    // ISOLAMENTO DE DADOS: Apenas a doutora tem acesso total. Paciente só acessa a si mesmo.
    if (req.user.role !== 'DOCTOR') {
      const isSelf = (patient.userId && patient.userId.toString() === req.user.id) ||
                     (patient.email && patient.email.toLowerCase() === req.user.email?.toLowerCase());
      if (!isSelf) {
        return res.status(403).json({ error: 'Acesso negado: Você só pode anexar exames na sua própria ficha.' });
      }
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

// LISTAR EXAMES DO PACIENTE
app.get('/api/patients/:id/exams', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    // ISOLAMENTO DE DADOS
    if (req.user.role !== 'DOCTOR') {
      const isSelf = (patient.userId && patient.userId.toString() === req.user.id) ||
                     (patient.email && patient.email.toLowerCase() === req.user.email?.toLowerCase());
      if (!isSelf) {
        return res.status(403).json({ error: 'Acesso negado: Você só pode ver seus próprios exames.' });
      }
    }

    res.json({ success: true, exams: patient.exams || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REMOVER EXAME ANEXADO
app.delete('/api/patients/:id/exams/:examId', authMiddleware, async (req, res) => {
  try {
    const { id, examId } = req.params;
    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    // ISOLAMENTO DE DADOS
    if (req.user.role !== 'DOCTOR') {
      const isSelf = (patient.userId && patient.userId.toString() === req.user.id) ||
                     (patient.email && patient.email.toLowerCase() === req.user.email?.toLowerCase());
      if (!isSelf) {
        return res.status(403).json({ error: 'Acesso negado: Você só pode remover seus próprios exames.' });
      }
    }

    patient.exams = patient.exams.filter(ex => ex._id.toString() !== examId);
    await patient.save();

    res.json({ success: true, message: 'Exame removido com sucesso', exams: patient.exams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PACIENTE ANEXA EXAME NA SUA PRÓPRIA FICHA
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
// Gerenciamento e persistência das perguntas da anamnese
// ==============================================================================

// LISTAR PERGUNTAS DA ANAMNESE
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

// ADICIONAR NOVA PERGUNTA
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

// ATUALIZAR PERGUNTA
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

// REMOVER PERGUNTA
app.delete('/api/questions/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const question = await Question.findOneAndDelete({ id: req.params.id });
    if (!question) return res.status(404).json({ error: 'Pergunta não encontrada' });
    res.json({ success: true, message: 'Pergunta removida com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REINICIALIZAR PERGUNTAS PADRÃO
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

// SALVAR FICHA DE ANAMNESE (Doutora - Salva para clientes novos ou existentes)
app.post('/api/anamnesis', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { 
      id, patientId, patientName, patientEmail, patientPhone,
      doctorName, pressurePreference, mainObjective, 
      bodyAreas, answers, detectedAlerts, clinicalObservations, recommendedTechniques, exams 
    } = req.body;

    // 1. Sanitizar bodyAreas de forma 100% segura contra CastError
    let cleanBodyAreas = [];
    if (Array.isArray(bodyAreas)) {
      cleanBodyAreas = bodyAreas.map(b => {
        if (typeof b === 'string') {
          try {
            const parsed = JSON.parse(b);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
          } catch {}
          return { id: b, name: b, type: 'dor_tensao', intensity: 5 };
        }
        return b;
      });
    } else if (typeof bodyAreas === 'string') {
      try {
        const parsed = JSON.parse(bodyAreas);
        if (Array.isArray(parsed)) {
          cleanBodyAreas = parsed;
        } else if (typeof parsed === 'object' && parsed !== null) {
          cleanBodyAreas = [parsed];
        }
      } catch {
        cleanBodyAreas = [];
      }
    }

    // 2. Extrair dados para identificação do paciente (amarração 100%)
    const cleanEmail = (patientEmail || req.body.email || answers?.q_email || '').toLowerCase().trim();
    const cleanPhone = (patientPhone || req.body.phone || answers?.q_telefone || '').trim();
    const cleanName = (patientName || req.body.name || answers?.q_nome || 'Paciente').trim();

    let patient = null;

    // A) Se patientId for um ObjectId válido do MongoDB, tenta buscar diretamente
    if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findById(patientId);
    }

    // B) Se não encontrou por ID (ou se patientId era string tipo local "pat-1234"), tenta por email
    if (!patient && cleanEmail) {
      patient = await Patient.findOne({ email: cleanEmail });
    }

    // C) Se não encontrou por email, tenta por telefone
    if (!patient && cleanPhone) {
      patient = await Patient.findOne({ phone: cleanPhone });
    }

    // D) Se não encontrou por telefone, tenta pelo nome exato (se não for genérico)
    if (!patient && cleanName && cleanName.toLowerCase() !== 'paciente') {
      patient = await Patient.findOne({ name: new RegExp(`^${cleanName}$`, 'i') });
    }

    // E) Se o paciente ainda não existir no banco, cria o paciente e seu usuário correspondente (Amarração 100%)
    if (!patient) {
      const generatedEmail = cleanEmail || `paciente_${Date.now()}@clinica.com`;

      // Garante que o User correspondente exista para permitir login no portal
      let user = await User.findOne({ email: generatedEmail });
      if (!user) {
        const defaultHash = await bcrypt.hash('123456', 10);
        user = await User.create({
          name: cleanName,
          email: generatedEmail,
          phone: cleanPhone || '(11) 99999-9999',
          password: defaultHash,
          role: 'PATIENT',
          status: 'approved',
          isApproved: true,
          approvedBy: req.user?.id,
          approvedAt: new Date()
        });
      }

      patient = await Patient.create({
        userId: user._id,
        name: cleanName,
        email: generatedEmail,
        phone: cleanPhone || user.phone || '(11) 99999-9999',
        treatmentType: 'Massoterapia e Estética Corporal',
        status: 'ativo',
        totalSessions: 1,
        lastVisit: new Date().toISOString().split('T')[0],
        notes: clinicalObservations || '',
        approvedBy: req.user?.id,
        approvedAt: new Date()
      });
      console.log(`✅ Novo paciente criado e amarrado automaticamente ao salvar anamnese: ${patient.name} (${patient.email})`);
    } else {
      // Paciente existente: incrementa sessões e atualiza última visita
      patient.totalSessions = (patient.totalSessions || 0) + 1;
      patient.lastVisit = new Date().toISOString().split('T')[0];
      if (cleanPhone && (!patient.phone || patient.phone === '(11) 99999-9999')) {
        patient.phone = cleanPhone;
      }
      if (clinicalObservations && !patient.notes) {
        patient.notes = clinicalObservations;
      }

      // Se o paciente não tiver userId vinculado, amarra ao User
      if (!patient.userId) {
        let user = await User.findOne({ email: patient.email.toLowerCase().trim() });
        if (!user) {
          const defaultHash = await bcrypt.hash('123456', 10);
          user = await User.create({
            name: patient.name,
            email: patient.email,
            phone: patient.phone,
            password: defaultHash,
            role: 'PATIENT',
            status: 'approved',
            isApproved: true
          });
        }
        patient.userId = user._id;
      }
      await patient.save();
    }

    // 3. Salvar ou atualizar Ficha de Anamnese no banco
    let anamnesis = null;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      anamnesis = await Anamnesis.findById(id);
    }

    if (anamnesis) {
      anamnesis.patientId = patient._id;
      anamnesis.patientName = patient.name;
      anamnesis.patientEmail = patient.email;
      anamnesis.patientPhone = patient.phone;
      anamnesis.doctorName = doctorName || 'Dra. Yasmin Oliveira';
      anamnesis.pressurePreference = pressurePreference || 'Média / Terapêutica';
      anamnesis.mainObjective = mainObjective || 'Bem-estar e estética corporal';
      anamnesis.bodyAreas = cleanBodyAreas;
      anamnesis.answers = answers || {};
      anamnesis.detectedAlerts = detectedAlerts || [];
      anamnesis.clinicalObservations = clinicalObservations || '';
      anamnesis.recommendedTechniques = recommendedTechniques || [];
      anamnesis.updatedAt = new Date();
      await anamnesis.save();
    } else {
      anamnesis = await Anamnesis.create({
        patientId: patient._id,
        patientName: patient.name,
        patientEmail: patient.email,
        patientPhone: patient.phone,
        doctorName: doctorName || 'Dra. Yasmin Oliveira',
        pressurePreference: pressurePreference || 'Média / Terapêutica',
        mainObjective: mainObjective || 'Bem-estar e estética corporal',
        bodyAreas: cleanBodyAreas,
        answers: answers || {},
        detectedAlerts: detectedAlerts || [],
        clinicalObservations: clinicalObservations || '',
        recommendedTechniques: recommendedTechniques || [],
        exams: exams || [],
        status: 'concluido'
      });
    }

    console.log(`📋 Anamnese gravada com sucesso para ${patient.name} (ID: ${anamnesis._id})`);

    res.status(201).json({ 
      success: true, 
      message: 'Ficha de anamnese salva com sucesso no banco de dados',
      anamnesis: {
        id: anamnesis._id.toString(),
        patientId: patient._id.toString(),
        patientName: patient.name,
        patientEmail: patient.email,
        patientPhone: patient.phone,
        doctorName: anamnesis.doctorName,
        pressurePreference: anamnesis.pressurePreference,
        mainObjective: anamnesis.mainObjective,
        bodyAreas: anamnesis.bodyAreas,
        answers: anamnesis.answers,
        detectedAlerts: anamnesis.detectedAlerts,
        clinicalObservations: anamnesis.clinicalObservations,
        recommendedTechniques: anamnesis.recommendedTechniques,
        status: anamnesis.status,
        createdAt: anamnesis.createdAt ? anamnesis.createdAt.toISOString() : new Date().toISOString()
      },
      patient: {
        id: patient._id.toString(),
        userId: patient.userId ? patient.userId.toString() : '',
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        status: patient.status,
        treatmentType: patient.treatmentType,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit
      }
    });
  } catch (err) {
    console.error('❌ Erro ao salvar anamnese no backend:', err);
    res.status(500).json({ error: err.message });
  }
});

// ATUALIZAR FICHA DE ANAMNESE POR ID
app.put('/api/anamnesis/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };

    if (updateData.bodyAreas && Array.isArray(updateData.bodyAreas)) {
      updateData.bodyAreas = updateData.bodyAreas.map(b => {
        if (typeof b === 'string') {
          try { return JSON.parse(b); } catch { return { id: b, name: b, type: 'dor_tensao', intensity: 5 }; }
        }
        return b;
      });
    }

    let updated = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updated = await Anamnesis.findByIdAndUpdate(id, updateData, { new: true });
    }

    if (!updated) {
      return res.status(404).json({ error: 'Ficha de anamnese não encontrada' });
    }

    res.json({
      success: true,
      message: 'Ficha de anamnese atualizada com sucesso',
      anamnesis: {
        id: updated._id.toString(),
        patientId: updated.patientId ? updated.patientId.toString() : '',
        patientName: updated.patientName || '',
        patientEmail: updated.patientEmail || '',
        patientPhone: updated.patientPhone || '',
        doctorName: updated.doctorName,
        pressurePreference: updated.pressurePreference,
        mainObjective: updated.mainObjective,
        bodyAreas: updated.bodyAreas,
        answers: updated.answers,
        detectedAlerts: updated.detectedAlerts,
        clinicalObservations: updated.clinicalObservations,
        recommendedTechniques: updated.recommendedTechniques,
        status: updated.status,
        createdAt: updated.createdAt ? updated.createdAt.toISOString() : new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LISTAR TODAS AS ANAMNESES (Doutora)
app.get('/api/anamnesis', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const rawRecords = await Anamnesis.find().sort({ createdAt: -1 });
    const records = rawRecords.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId ? a.patientId.toString() : '',
      patientName: a.patientName || '',
      patientEmail: a.patientEmail || '',
      patientPhone: a.patientPhone || '',
      doctorName: a.doctorName || 'Dra. Yasmin Oliveira',
      pressurePreference: a.pressurePreference || 'Média / Terapêutica',
      mainObjective: a.mainObjective || 'Bem-estar e estética corporal',
      bodyAreas: a.bodyAreas || [],
      answers: a.answers || {},
      detectedAlerts: a.detectedAlerts || [],
      clinicalObservations: a.clinicalObservations || '',
      recommendedTechniques: a.recommendedTechniques || [],
      status: a.status || 'concluido',
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString()
    }));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BUSCAR ANAMNESE POR ID DO PACIENTE
app.get('/api/anamnesis/patient/:patientId', authMiddleware, async (req, res) => {
  try {
    const { patientId } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      query = { patientId };
    } else {
      const patient = await Patient.findOne({
        $or: [
          { email: patientId.toLowerCase().trim() },
          { phone: patientId }
        ]
      });
      if (patient) {
        query = { patientId: patient._id };
      } else {
        query = { patientEmail: patientId.toLowerCase().trim() };
      }
    }

    const rawRecords = await Anamnesis.find(query).sort({ createdAt: -1 });
    const records = rawRecords.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId ? a.patientId.toString() : '',
      patientName: a.patientName || '',
      patientEmail: a.patientEmail || '',
      patientPhone: a.patientPhone || '',
      doctorName: a.doctorName || 'Dra. Yasmin Oliveira',
      pressurePreference: a.pressurePreference || 'Média / Terapêutica',
      mainObjective: a.mainObjective || 'Bem-estar e estética corporal',
      bodyAreas: a.bodyAreas || [],
      answers: a.answers || {},
      detectedAlerts: a.detectedAlerts || [],
      clinicalObservations: a.clinicalObservations || '',
      recommendedTechniques: a.recommendedTechniques || [],
      status: a.status || 'concluido',
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString()
    }));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MINHAS ANAMNESES (Paciente logado)
app.get('/api/anamnesis/my', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email?.toLowerCase().trim();
    const patient = await Patient.findOne({
      $or: [
        { userId: req.user.id },
        { email: userEmail }
      ]
    });

    let query = {};
    if (patient) {
      query = {
        $or: [
          { patientId: patient._id },
          { patientEmail: userEmail }
        ]
      };
    } else if (userEmail) {
      query = { patientEmail: userEmail };
    }

    const rawRecords = await Anamnesis.find(query).sort({ createdAt: -1 });
    const records = rawRecords.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId ? a.patientId.toString() : '',
      patientName: a.patientName || '',
      patientEmail: a.patientEmail || '',
      patientPhone: a.patientPhone || '',
      doctorName: a.doctorName || 'Dra. Yasmin Oliveira',
      pressurePreference: a.pressurePreference || 'Média / Terapêutica',
      mainObjective: a.mainObjective || 'Bem-estar e estética corporal',
      bodyAreas: a.bodyAreas || [],
      answers: a.answers || {},
      detectedAlerts: a.detectedAlerts || [],
      clinicalObservations: a.clinicalObservations || '',
      recommendedTechniques: a.recommendedTechniques || [],
      status: a.status || 'concluido',
      createdAt: a.createdAt ? a.createdAt.toISOString() : new Date().toISOString()
    }));
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// 7. ROTAS DE AGENDAMENTO (/api/appointments)
// ==============================================================================

// AGENDAR CONSULTA
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
      status: req.user.role === 'DOCTOR' ? 'confirmado' : 'pendente'
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

// MINHAS CONSULTAS (Paciente logado)
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

// TODAS AS CONSULTAS (Doutora)
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

// ATUALIZAR STATUS DA CONSULTA
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

// Fallback para quando o MongoDB estiver offline
app.use((err, req, res, next) => {
  if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && err.message.includes('buffering timed out'))) {
    console.warn('[AI Studio] Database offline — returning mock empty response');
    if (req.method === 'GET') {
      return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
    }
    return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
  }
  next(err);
});

// ==============================================================================
// INICIALIZAÇÃO DO SERVIDOR COM INTEGRAÇÃO VITE
// ==============================================================================

async function startServer() {
  // Em desenvolvimento (ou AI Studio container): monta middleware do Vite
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
    // Em produção (Render ou container isolado)
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
