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
const TestResultSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  testId: { type: String, required: true },
  testName: { type: String, required: true },
  completionDate: { type: Date, required: true },
  totalScore: { type: Number, required: true },
  individualScores: { type: [Number], default: [] }
});

const TestResult = mongoose.model('TestResult', TestResultSchema);
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

// ... dopo la rotta app.get('/dati', ...)

// --- INIZIO CODICE AGGIUNTO PER ENDPOINT TEST ---
app.post('/tests', async (req, res) => {
  console.log('Ricevuta richiesta POST su /tests'); // Log per debugging
  console.log('Body ricevuto:', req.body); // Log per vedere i dati

  try {
    // Il frontend invia un oggetto con campo 'contenuto' che è una stringa JSON
    // Questa stringa JSON dovrebbe contenere l'array completo dei risultati dei test
    const receivedDataString = req.body.contenuto;

    if (!receivedDataString) {
         return res.status(400).json({ ok: false, errore: 'Campo contenuto mancante nel body' });
    }

    let testResultsArray;
    try {
        // Parsa la stringa JSON per ottenere l'array di risultati
        testResultsArray = JSON.parse(receivedDataString);
        if (!Array.isArray(testResultsArray)) {
             throw new Error('Contenuto non è un array valido');
        }
    } catch (parseError) {
         console.error('Errore parsing JSON:', parseError);
         return res.status(400).json({ ok: false, errore: 'Formato JSON del contenuto non valido.' });
    }

    // --- LOGICA DI SALVATAGGIO TEST ---
    // Questo è il punto critico: come gestire l'array completo ricevuto?
    // Opzione semplice (NON scalabile): Cancella tutti i vecchi risultati e salva i nuovi
    // Questa è una soluzione rapida per testare, ma NON raccomandata per l'uso reale
    // perché cancellerebbe i dati se l'importazione fallisce parzialmente.

    // **APPROCCIO MIGLIORE (Ma più complesso): Aggiornare o Inserire basandosi sull'ID**
    // Poiché il tuo frontend genera ID unici per i risultati importati,
    // possiamo usare findOneAndUpdate o bulkWrite.
    // Per semplicità immediata, useremo un approccio di upsert (insert or update).

    const bulkOps = testResultsArray.map(result => {
        // Assicurati che la data sia un oggetto Date valido
        // Mongoose gestirà la conversione se la stringa è in un formato valido (come ISO)
         result.completionDate = new Date(result.completionDate);

         // Assicurati che individualScores sia un array (potrebbe essere null o stringa dal CSV in vecchi formati)
         if (!Array.isArray(result.individualScores)) {
             // Prova a parsare se è una stringa JSON, altrimenti usa un array vuoto
             try {
                const parsedScores = JSON.parse(result.individualScores);
                result.individualScores = Array.isArray(parsedScores) ? parsedScores : [];
             } catch {
                result.individualScores = [];
             }
         }


         return {
             updateOne: {
                 filter: { id: result.id }, // Trova il documento per l'ID
                 update: { $set: result }, // Aggiorna l'intero documento
                 upsert: true // Se non trovato, inseriscilo
             }
         };
     });

    // Esegui le operazioni in blocco
    const bulkWriteResult = await TestResult.bulkWrite(bulkOps);
    console.log(`Bulk write completato: ${bulkWriteResult.upsertedCount} inseriti, ${bulkWriteResult.modifiedCount} modificati`);

    res.json({ ok: true, message: 'Risultati test salvati/aggiornati con successo.' });

  } catch (e) {
    console.error('🔴 Errore salvataggio test:', e); // Log dettagliato dell'errore
    res.status(500).json({ ok: false, errore: e.message });
  }
});

// Aggiungi anche l'endpoint GET /tests per permettere al frontend di caricare i test
app.get('/tests', async (req, res) => {
    console.log('Ricevuta richiesta GET su /tests'); // Log per debugging
    try {
        const testResults = await TestResult.find(); // Recupera tutti i risultati dei test
        // Il frontend si aspetta un array di oggetti con campo 'contenuto'
        // Invece di salvare ogni test come un documento con campo 'contenuto',
        // possiamo restituire l'array di risultati direttamente.
        // Il frontend legge JSON.parse(datiRemoti[datiRemoti.length - 1].contenuto)
        // Dobbiamo quindi inviare i dati in un formato che il frontend si aspetti per la lettura.
        // La funzione loadTestResults nel frontend si aspetta un array di oggetti,
        // non un array di oggetti con campo 'contenuto'.

        // Correggiamo l'assunto sul formato del frontend: loadTestResults si aspetta
        // testResultsData[testResultsData.length - 1].contenuto
        // E testResultsData sembra un array di oggetti con campo 'contenuto'
        // Forniremo un singolo documento che contiene l'intero array come 'contenuto'
        // Questo si allinea a come carichi le entries in loadEntries()

        if (testResults.length === 0) {
            res.json([]); // Se non ci sono risultati, restituisci un array vuoto
        } else {
             // Invia l'ultimo salvataggio come un documento con l'array completo in 'contenuto'
             // Questo imita il formato che il frontend sembra aspettarsi
             // NON è l'ideale, ma rende compatibile con il frontend esistente.
             // Idealmente, il backend esporrebbe solo l'array diretto.
             // Per compatibilità con il tuo frontend attuale, usiamo questo wrapper:
             res.json([{ contenuto: JSON.stringify(testResults) }]);
        }


    } catch (e) {
        console.error('🔴 Errore recupero test:', e); // Log dettagliato dell'errore
        res.status(500).json({ ok: false, errore: e.message });
    }
});

// --- FINE CODICE AGGIUNTO PER ENDPOINT TEST ---

// ... il blocco app.listen modificato (che usa process.env.PORT) segue qui

const port = process.env.PORT || 3000; // Usa la porta fornita da Render o 3000 come fallback
app.listen(port, () => {
  console.log(`✅ Server avviato sulla porta ${port}`); // Modifica il messaggio per mostrare la porta corretta
});
