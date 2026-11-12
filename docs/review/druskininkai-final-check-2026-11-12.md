# Druskininkai — controllo finale del 12 novembre 2026

Controllo della presentazione corrente: 59 coppie inglese/lituano, 118 slide totali. La chiusura è alle pagine 115–116; la bibliografia alle pagine 117–118. Revisione svolta con le indicazioni di Impeccable, daisyUI e Slidev, mantenendo l’identità grafica esistente.

## Correzioni effettuate

- Slide QR: contenimento dell’immagine nello spazio disponibile e link leggibile senza invadere la colonna del QR.
- Slide sui concetti: ridotti gli spazi dei diagrammi per evitare che il testo lituano si accosti alla riga conclusiva; mantenuti i testi e le dimensioni del corpo.
- Stampa: corretti gli ingombri della mappa e della tabella dei piani a pagamento in lituano.
- Audio: avviare la narrazione mette in pausa la dimostrazione della stessa slide e viceversa. Le posizioni di riproduzione restano conservate. Aggiunto un test di regressione.
- Accessibilità: tradotte le etichette di Andrea, del libro, dei media di Notebook e dell’elenco degli strumenti; mantenuti i nomi propri e i nomi delle funzioni.

## Evidenze

| Controllo | Risultato |
| --- | --- |
| Tutte le 118 slide, vista d’insieme e apertura individuale | Nessuna immagine non caricata o testo fuori dal canvas dopo le correzioni |
| 47 player di narrazione, provati uno per uno nel browser | Riproduzione, durata e sottotitoli disponibili, nessun errore media |
| Sovrapposizioni tra sottotitoli e contenuto | Nessuna nelle slide provate |
| 47 MP3 decodificati integralmente con FFmpeg | Tutti validi, 44.1 kHz / 128 kbps; livelli medi fra −24.2 e −21.8 dBFS, picco massimo −1.1 dBFS |
| Testi delle note, MP3, VTT e tempi delle parole | Controllate corrispondenza e impronte dei file |
| Sei slide con avanzamenti sincronizzati | Tutti i marcatori verificati sui tempi delle parole; prove di riavvio e avanzamento nel browser |
| Libro animato | Segue la narrazione; pausa e riavvio coerenti; termine sul retro; immagine statica con movimento ridotto |
| Vista relatore | Verificata anche a 840 × 848; nessun player attivo nella preview Next |
| Stampa statica | 118 slide, nessuna narrazione attiva, nessuna rivelazione nascosta, nessun overflow dello stage |
| Registrazioni dimostrative | Integrità di 40 registrazioni e un video originale esportato verificata dal manifest |
| Console delle aperture individuali e del pacchetto compilato | Nessun errore; nessun avviso nella versione compilata |
| Detector Impeccable sul codice | Nessuna segnalazione deterministica; revisione visiva eseguita separatamente |
| `pnpm check` | 33 test superati, oltre ai controlli di contenuto, asset, link e traduzioni |
| `pnpm build` | Compilate EduForum, MRU e Druskininkai |
| Pacchetto compilato servito localmente | Verificati i percorsi condivisi di MP3, VTT e tempi delle parole, riproduzione e fine audio |

I colori del testo sono coerenti tra le superfici chiare e scure. Fra i campioni calcolati: verde acqua sul fondo scuro 9.50:1, verde scuro sul fondo chiaro 7.21:1, testo grigio sul fondo chiaro 7.32:1, accento chiaro sulla superficie verde 5.55:1. Queste misure non costituiscono una certificazione WCAG completa.

## Copertura delle narrazioni

Sono presenti 47 narrazioni lituane, per circa 16 minuti e 46 secondi complessivi, tutte con sottotitoli e tempi delle parole. Restano senza narrazione le seguenti dimostrazioni, che non erano state richieste per la generazione:

| Slide LT | Dimostrazione |
| --- | --- |
| 46 | `/mistakelog` |
| 50 | `/matchinggame` |
| 52 | `/sortinggame` |
| 54 | `/oral` |
| 58 | `/fillintheblanks` |
| 60 | `/worksheet` |
| 62 | `/caseStudy` |
| 66 | `/lessonplan` |
| 68 | `/differentiate` |
| 70 | `/peerassessment` |
| 72 | `/learningstations` |

Anche la bibliografia lituana, slide 118, è senza narrazione. Le copie inglesi non hanno narrazione generata. Non sono state effettuate nuove chiamate a ElevenLabs durante questo controllo.

## Valutazione e limiti

| Dimensione Impeccable | Valutazione indicativa | Nota |
| --- | --- | --- |
| Accessibilità | 3/4 | Etichette, tastiera, sottotitoli e movimento ridotto verificati; nessuna prova con lettore di schermo reale |
| Prestazioni | 3/4 | Assenza di errori di esecuzione, caricamento dei media su richiesta; non eseguito un benchmark di frame rate su tutti i dispositivi |
| Tema | 4/4 | Palette e token coerenti; contrasti campionati adeguati |
| Adattamento | 2/4 | Canvas fisso 16:9; su telefono i contenuti e i controlli scalano insieme e richiedono ingrandimento |
| Integrità dell’implementazione | 4/4 | Controlli, compilazione e regressione audio superati |
| Totale | 16/20 | Buono per la presentazione su desktop/proiettore |

Nessun problema bloccante residuo rilevato nell’uso desktop verificato. Rimane un limite P2 sui telefoni: la presentazione si adatta senza scorrimento orizzontale, ma non sostituisce un’interfaccia touch con controlli di dimensioni indipendenti dal canvas. La prova a 390 × 844 è un’emulazione di viewport, non una prova gestuale su un telefono fisico. Tutti gli MP3 sono stati decodificati e avviati; non è stata svolta una revisione fonetica da parte di un madrelingua. Le verifiche dei video distinguono l’integrità dei file dalla visione integrale di ogni registrazione.

Durante i ricaricamenti a caldo della vista d’insieme il server di sviluppo ha segnalato `ClicksContext: Unexpected register after mounted`. Il controllo nel codice installato di Slidev conferma che è un avviso limitato a `__DEV__`, quando si registrano nuovamente le rivelazioni dopo il montaggio. La compilazione e le prove degli avanzamenti sul pacchetto pubblicabile sono passate; l’avviso di sviluppo non è stato nascosto o disabilitato.

Le impostazioni temporanee di viewport e movimento ridotto sono state ripristinate. Non sono stati eseguiti commit o push. Il sistema grafico resta documentato principalmente nei token e nei componenti; se serve un documento di progetto separato, `impeccable init` può raccoglierlo in un’attività dedicata.
