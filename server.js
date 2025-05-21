process.on('uncaughtException', (err) => {
  console.error('🔴 ERRORE CRITICO NON GESTITO:', err);
  console.error('Stack trace:', err.stack); // Aggiungi la stack trace
  // Non uscire subito in Render per permettere al log di essere catturato
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🟡 PROMISE REJECTION NON GESTITA:', reason, promise);
  // process.exit(1);
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 URI di connessione (aggiorna con le tue credenziali!)
const URI = 'mongodb+srv://amartini1008:MongoTest123@cluster0.zpblpdt.mongodb.net/miodb?retryWrites=true&w=majority&appName=Cluster0';

mongoose
  .connect(URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('🟢 Connesso a MongoDB Atlas!'))
  .catch(err => console.error('🔴 Errore connessione MongoDB:', err.message));

const DatoSchema = new mongoose.Schema({ contenuto: String });
const Dato = mongoose.model('Dato', DatoSchema);

app.post('/salva', async (req, res) => {
  try {
    const nuovo = new Dato(req.body);
    await nuovo.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, errore: e.message });
  }
});

app.get('/dati', async (req, res) => {
  try {
    const dati = await Dato.find();
    res.json(dati);
  } catch (e) {
    res.status(500).json({ ok: false, errore: e.message });
  }
});

const port = process.env.PORT || 3000; // Usa la porta fornita da Render o 3000 come fallback
app.listen(port, () => {
  console.log(`✅ Server avviato sulla porta ${port}`); // Modifica il messaggio per mostrare la porta corretta
});
