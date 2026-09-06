// ==============================================================================
// SERVIDOR COMPLETO - Clínica Dra. Yasmin (CORRIGIDO)
// ==============================================================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_dra_yasmin_super_segura_2026';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dev:dev123@cluster0.oflxvxo.mongodb.net/clinica_yasmin?retryWrites=true&w=majority&appName=Cluster0';

// ==============================================================================
// MIDDLEWARES
// ==============================================================================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://172.30.16.1:3000', 'http://10.0.0.118:3000'],
  credentials: true
}));
app.use(express.json());

// ==============================================================================
// CONEXÃO MONGODB
// ==============================================================================
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Conectado ao MongoDB Atlas');
    await createDefaultDoctor();
    console.log('📋 Sistema e usuário padrão prontos para uso');
  })
  .catch(err => {
    console.error('❌ Erro na conexão MongoDB:', err.message);
    process.exit(1);
  });

// ==============================================================================
// MODELOS (SCHEMAS)
// ==============================================================================

// 1. Usuário
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['DOCTOR', 'PATIENT'], default: 'PATIENT' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// 2. Paciente
const PatientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  birthDate: String,
  gender: { type: String, enum: ['Feminino', 'Masculino', 'Outro'], default: 'Feminino' },
  occupation: String,
  emergencyContact: String,
  emergencyPhone: String,
  status: { type: String, enum: ['ativo', 'inativo', 'retorno_pendente', 'aguardando_aprovacao'], default: 'aguardando_aprovacao' },
  treatmentType: { type: String, default: 'Massoterapia e Estética Corporal' },
  notes: String,
  totalSessions: { type: Number, default: 0 },
  lastVisit: String,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
const Patient = mongoose.model('Patient', PatientSchema);

// 3. Anamnese
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
  clinicalObservations: String,
  recommendedTechniques: [String],
  status: { type: String, enum: ['concluido', 'em_andamento'], default: 'concluido' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Anamnesis = mongoose.model('Anamnesis', AnamnesisSchema);

// 4. Agendamento
const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  service: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ['agendado', 'confirmado', 'realizado', 'cancelado'], default: 'agendado' },
  notes: String,
  doctorName: { type: String, default: 'Dra. Yasmin Oliveira' },
  createdAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// ==============================================================================
// MIDDLEWARES DE AUTENTICAÇÃO
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
// ROTAS DE AUTENTICAÇÃO
// ==============================================================================

// 1. REGISTRO - Verifica se paciente já existe pelo email
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Verifica se usuário já existe
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'E-mail já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';

    // 🔍 VERIFICA SE JÁ EXISTE UM PACIENTE COM ESTE EMAIL (criado pela Dra. Yasmin)
    const existingPatient = await Patient.findOne({ email: cleanEmail });

    // Cria o usuário
    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      password: hashedPassword,
      role: assignedRole,
      status: 'pending',
      isApproved: false
    });

    let createdPatient = null;

    if (assignedRole === 'PATIENT') {
      if (existingPatient) {
        // ✅ PACIENTE JÁ EXISTE! Atualiza com userId e aguarda aprovação
        createdPatient = await Patient.findByIdAndUpdate(
          existingPatient._id,
          { 
            userId: newUser._id,
            name: name.trim(),
            phone: phone.trim(),
            status: 'aguardando_aprovacao'
          },
          { new: true }
        );
        console.log(`🔗 Paciente existente vinculado ao novo usuário: ${cleanEmail}`);
      } else {
        // 🆕 PACIENTE NÃO EXISTE - Cria novo
        createdPatient = await Patient.create({
          userId: newUser._id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          status: 'aguardando_aprovacao',
          treatmentType: 'Massoterapia e Estética Corporal'
        });
        console.log(`✅ Novo paciente criado aguardando aprovação: ${cleanEmail}`);
      }
    }

    const token = jwt.sign(
      { id: newUser._id.toString(), role: newUser.role, email: newUser.email, status: newUser.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: existingPatient 
        ? 'Cadastro realizado! Aguarde a aprovação da Dra. Yasmin para vincular à sua ficha existente.'
        : 'Cadastro realizado com sucesso! Aguarde a aprovação da Dra. Yasmin.',
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
      patient: createdPatient,
      isExistingPatient: !!existingPatient
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: err.message || 'Erro interno ao cadastrar' });
  }
});

// 2. LOGIN
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

    // Verifica se o paciente foi aprovado
    if (user.role === 'PATIENT' && user.status !== 'approved') {
      return res.status(403).json({ 
        error: 'Aguardando aprovação da Dra. Yasmin.',
        status: user.status 
      });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
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

// 3. ME
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
// ROTAS DE APROVAÇÃO (Dra. Yasmin)
// ==============================================================================

// 4. LISTAR PACIENTES PENDENTES
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
    console.error('Erro ao listar pendentes:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. APROVAR PACIENTE (CORRIGIDO)
app.post('/api/patients/approve/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📤 Aprovando paciente ID:', id);
    
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    // Busca o paciente
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    console.log('📋 Paciente encontrado:', patient.name, patient.email);

    // Busca o usuário vinculado
    if (!patient.userId) {
      return res.status(400).json({ error: 'Paciente não possui usuário vinculado' });
    }

    const user = await User.findById(patient.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Atualiza o paciente
    patient.status = 'ativo';
    patient.approvedBy = req.user.id;
    patient.approvedAt = new Date();
    await patient.save();

    // Atualiza o usuário
    user.status = 'approved';
    user.isApproved = true;
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    await user.save();

    console.log(`✅ Paciente aprovado: ${patient.name}`);

    res.json({
      success: true,
      message: 'Paciente aprovado com sucesso!',
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        status: patient.status
      },
      user: {
        id: user._id.toString(),
        email: user.email,
        status: user.status
      }
    });
  } catch (err) {
    console.error('❌ Erro ao aprovar paciente:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. REJEITAR PACIENTE
app.post('/api/patients/reject/:id', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID do paciente é obrigatório' });
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const user = await User.findById(patient.userId);
    if (user) {
      user.status = 'rejected';
      user.isApproved = false;
      await user.save();
    }

    patient.status = 'inativo';
    await patient.save();

    res.json({
      success: true,
      message: 'Paciente rejeitado!',
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        status: patient.status
      }
    });
  } catch (err) {
    console.error('❌ Erro ao rejeitar paciente:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. VINCULAR PACIENTE EXISTENTE
app.post('/api/patients/link', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { email, patientId, userId } = req.body;
    
    console.log('📤 Vinculando paciente:', { email, patientId, userId });
    
    if (!email || !patientId || !userId) {
      return res.status(400).json({ error: 'Email, patientId e userId são obrigatórios' });
    }

    if (patientId === 'undefined' || userId === 'undefined') {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Busca o paciente existente (que já tem ficha)
    const existingPatient = await Patient.findOne({ 
      email: cleanEmail,
      _id: { $ne: patientId } // Não pode ser o mesmo paciente
    });

    if (!existingPatient) {
      return res.status(404).json({ error: 'Paciente existente não encontrado' });
    }

    // Busca o usuário pendente
    const pendingUser = await User.findById(userId);
    if (!pendingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Busca o paciente pendente
    const pendingPatient = await Patient.findById(patientId);
    if (!pendingPatient) {
      return res.status(404).json({ error: 'Paciente pendente não encontrado' });
    }

    // =============================================
    // VINCULAR: Usuário pendente -> Paciente existente
    // =============================================

    // 1. Atualiza o paciente existente com o userId do usuário pendente
    existingPatient.userId = pendingUser._id;
    existingPatient.status = 'ativo';
    existingPatient.approvedBy = req.user.id;
    existingPatient.approvedAt = new Date();
    await existingPatient.save();

    // 2. Atualiza o usuário pendente
    pendingUser.status = 'approved';
    pendingUser.isApproved = true;
    pendingUser.approvedBy = req.user.id;
    pendingUser.approvedAt = new Date();
    await pendingUser.save();

    // 3. Remove o paciente pendente (já que foi vinculado)
    await Patient.findByIdAndDelete(patientId);

    // 4. Migra anamneses do paciente pendente para o existente
    await Anamnesis.updateMany(
      { patientId: patientId },
      { patientId: existingPatient._id }
    );

    // 5. Migra agendamentos do paciente pendente para o existente
    await Appointment.updateMany(
      { patientId: patientId },
      { 
        patientId: existingPatient._id,
        patientName: existingPatient.name,
        patientPhone: existingPatient.phone
      }
    );

    console.log(`✅ Paciente vinculado: ${existingPatient.name} -> ${pendingUser.email}`);

    res.json({
      success: true,
      message: 'Paciente vinculado com sucesso!',
      linkedPatient: {
        id: existingPatient._id.toString(),
        name: existingPatient.name,
        email: existingPatient.email,
        status: existingPatient.status
      },
      user: {
        id: pendingUser._id.toString(),
        email: pendingUser.email,
        status: pendingUser.status
      }
    });
  } catch (err) {
    console.error('❌ Erro ao vincular paciente:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// ROTAS DE PACIENTES
// ==============================================================================

// 8. LISTAR PACIENTES
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
    
    const patientsWithUsers = await Promise.all(patients.map(async (p) => {
      const user = await User.findById(p.userId).select('-password');
      return {
        ...p.toObject(),
        id: p._id.toString(),
        user: user ? {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: user.status,
          isApproved: user.isApproved
        } : null
      };
    }));

    res.json({ success: true, total: patientsWithUsers.length, patients: patientsWithUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. CRIAR PACIENTE (Dra. Yasmin - já aprovado)
app.post('/api/patients', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { name, email, phone, birthDate, gender, occupation, emergencyContact, emergencyPhone, treatmentType, notes } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Nome, e-mail e telefone são obrigatórios' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    const existing = await Patient.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'Já existe um paciente com este e-mail' });
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
    }

    const patient = await Patient.create({
      userId: user._id,
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      birthDate,
      gender,
      occupation,
      emergencyContact,
      emergencyPhone,
      treatmentType: treatmentType || 'Massoterapia e Estética Corporal',
      notes,
      status: 'ativo',
      totalSessions: 0,
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
        status: patient.status,
        treatmentType: patient.treatmentType,
        notes: patient.notes,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit,
        createdAt: patient.createdAt ? patient.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================
// ROTAS DE ANAMNESE (resumidas para brevidade)
// ==============================================================================

app.post('/api/anamnesis', authMiddleware, requireDoctor, async (req, res) => {
  try {
    const { patientId, doctorName, pressurePreference, mainObjective, bodyAreas, answers, detectedAlerts, clinicalObservations, recommendedTechniques } = req.body;

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
      clinicalObservations,
      recommendedTechniques: recommendedTechniques || [],
      status: 'concluido'
    });
    
    await Patient.findByIdAndUpdate(patientId, {
      $inc: { totalSessions: 1 },
      lastVisit: new Date().toISOString().split('T')[0]
    });

    res.status(201).json({ 
      success: true, 
      message: 'Ficha de anamnese salva com sucesso',
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

// ==============================================================================
// ROTAS DE AGENDAMENTO (resumidas para brevidade)
// ==============================================================================

app.post('/api/appointments', authMiddleware, async (req, res) => {
  try {
    const { patientId, service, date, time, notes } = req.body;
    let patient = null;

    if (patientId) {
      patient = await Patient.findById(patientId);
    }
    if (!patient && req.user?.email) {
      patient = await Patient.findOne({ email: req.user.email });
    }

    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    if (patient.status === 'aguardando_aprovacao') {
      return res.status(403).json({ error: 'Paciente aguardando aprovação.' });
    }

    const appointment = await Appointment.create({
      patientId: patient._id,
      patientName: patient.name,
      patientPhone: patient.phone,
      service,
      date,
      time,
      notes,
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
    const patient = await Patient.findOne({ email: req.user.email });
    if (!patient) {
      return res.json({ success: true, appointments: [] });
    }

    const raw = await Appointment.find({ patientId: patient._id }).sort({ date: 1, time: 1 });
    const appointments = raw.map(a => ({
      id: a._id.toString(),
      patientId: a.patientId.toString(),
      patientName: a.patientName,
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
// ROTAS ADICIONAIS PARA PACIENTE
// ==============================================================================

// GET /api/patients/me - Perfil do paciente logado
app.get('/api/patients/me', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findOne({ email: req.user.email });
    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
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
        status: patient.status,
        treatmentType: patient.treatmentType,
        notes: patient.notes,
        totalSessions: patient.totalSessions,
        lastVisit: patient.lastVisit,
        createdAt: patient.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/anamnesis/my - Anamneses do paciente logado
app.get('/api/anamnesis/my', authMiddleware, async (req, res) => {
  try {
    const patient = await Patient.findOne({ email: req.user.email });
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

// DELETE /api/patients/:id
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

// ==============================================================================
// HEALTH CHECK
// ==============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    server: 'Clínica Dra. Yasmin - Sistema de Anamnese'
  });
});

// ==============================================================================
// CRIAR USUÁRIO PADRÃO
// ==============================================================================

async function createDefaultDoctor() {
  try {
    const doctorExists = await User.findOne({ email: 'dra.yasmin@clinica.com' });
    
    if (!doctorExists) {
      const hashedPassword = await bcrypt.hash('adminPassword2026!', 10);
      
      const doctor = await User.create({
        name: 'Dra. Yasmin Oliveira',
        email: 'dra.yasmin@clinica.com',
        phone: '(11) 99123-4567',
        password: hashedPassword,
        role: 'DOCTOR',
        status: 'approved',
        isApproved: true
      });
      
      console.log('✅ Dra. Yasmin criada com sucesso!');
      console.log('📧 Email: dra.yasmin@clinica.com');
      console.log('🔑 Senha: adminPassword2026!');
    }
  } catch (err) {
    console.error('❌ Erro ao criar usuário padrão:', err.message);
  }
}

// ==============================================================================
// INICIAR SERVIDOR
// ==============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log('=================================================');
});