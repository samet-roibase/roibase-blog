---
title: "ASO Creative Testing: PPO con +%32 IPM in 6 Settimane"
description: "Ottimizzare le immagini dell'App Store testando Custom Product Pages e Play Experiments per misurare incrementi misurabili di install-per-mille."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: gaming
i18nKey: gaming-001-2026-08
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 8
author: Roibase
---

Nel 2026, conquistare visibilità organica su App Store dipende più dalla performance creativa che dall'ottimizzazione delle keyword. Le Custom Product Pages di Apple e Play Experiments di Google consentono di testare varianti visive in modo controllato. In questo articolo spieghiamo un processo di ASO creative testing di 6 settimane, la metodologia PPO (Product Page Optimization) e le leve che hanno generato un incremento di +%32 IPM (Install-per-Mille) con metriche concrete.

## Custom Product Pages e Play Experiments: Configurare l'Ambiente di Test

Le Custom Product Pages permettono di mostrare set di screenshot diversi a fonti di traffico differenti per la stessa app. Un utente che proviene da Apple Search Ads vede un set di immagini, mentre chi arriva da ricerca organica ne vede un altro. Play Experiments replica questa logica lato Android tramite Google Play Console. Entrambi gli strumenti garantiscono: segmentazione del traffico controllata, attribution precisa, significatività statistica calcolabile.

Nella configurazione iniziale dell'ambiente di test, il primo passo è la segmentazione del traffico. Se investi più di $50k al mese su Apple Search Ads, configura la variante CPP specificamente per questo canale — poiché l'intent da keyword è già chiaro, mettere in primo piano le meccaniche di gameplay nella grafica aumenta la conversion. Per il traffico organico, prepara una variante incentrata sul personaggio principale con un emotional hook più forte. Su Play Experiments, puoi testare una singola variante contro il listing predefinito; il traffico si divide automaticamente 50-50, con una durata minima di test di 7 giorni obbligatoria.

### Formulare Ipotesi e Selezionare Metriche

L'ipotesi del creative test deve seguire questo formato: "Se utilizzo l'asset di meta-progression nello screenshot 3 al posto del gameplay, mi aspetto un incremento di +%5 nella D1 retention perché gli utenti dall'exit survey segnalano 'non capisco cosa guadagnerò'". In questo esempio la metrica è l'IPM (install-per-mille) — quanti install per mille visualizzazioni nel negozio. Si sceglie l'IPM perché rappresenta il primo gradino della conversion funnel di App Store, dove l'impatto diretto della creativa è visibile. La D1 retention è per il secondo ciclo di test — quando ottimizzerai l'onboarding post-install.

## Calendario di 6 Settimane e Distribuzione del Traffico

Il processo di 6 settimane si suddivide in 3 sprint: 2 settimane di raccolta dati baseline, 2 settimane di primo test variante, 2 settimane di micro-ottimizzazione sulla variante vincente. Nelle prime 2 settimane, utilizza il listing dello store attuale come gruppo di controllo — CPP o Play Experiments non sono ancora attivi, stai solo raccogliendo dati di traffico organico + paid. Registra l'IPM baseline; ad esempio: 48,2 IPM su Apple Search Ads, 32,7 IPM su traffico organico.

Settimane 3-4: attiva la variante CPP 1. Gestisci la distribuzione del traffico da Apple Search Ads Console: listing predefinito 50%, variante CPP 1 50%. Modifica dello screenshot: listing predefinito mostra il personaggio eroe in ritratto, variante 1 mostra personaggio eroe + arena PvP. Mantieni l'icona identica, cambia solo l'ordine degli screenshot — trasforma il 1° screenshot in gameplay. Dopo 2 settimane, se il traffico raggiunge 10k+ impressioni, è possibile testare la significatività statistica (test chi-quadrato, p < 0,05 come target). Se la variante 1 raggiunge 51,8 IPM — un incremento del +%7,5 — ha vinto.

Settimane 5-6: rendi la variante vincente il nuovo baseline e testa una micro-variazione: rimuovi gli elementi UI nello screenshot 2, usa un frame più "cinematico". Se l'IPM raggiunge 63,4 — un incremento totale di +%32 — passa questo in produzione. Se esegui test paralleli su Play Experiments lato Android, replica la stessa ipotesi con asset differenti (ad esempio video invece di screenshot statico). Se su Google Play è abilitato l'auto-play video, i primi 3 secondi del video devono essere il vero hook — rappresenta un ciclo di test separato.

### Significatività Statistica e Calcolo della Sample Size

Prima di concludere un creative test, verifica se la sample size sia sufficiente. Formula: `n = (Z^2 * p * (1-p)) / E^2`, dove Z = 1,96 (livello di confidenza 95%), p = baseline conversion rate (converti l'IPM in percentuale: 0,048), E = margine di errore (0,02). In questo esempio servono circa 4.600 impressioni. Se il traffico settimanale è 2k, il test deve durare 3 settimane. L'arresto anticipato significa identificare un vincitore falso, con costo opportunità elevato.

Se il p-value del test chi-quadrato risulta > 0,05, l'incremento non è statisticamente significativo — anche con uplift del %15, potrebbe essere noise. Prolunga il test di 1 settimana o aumenta il traffico. Su Apple Search Ads, puoi incrementare il budget e raddoppiare il volume di impressioni al segmento della variante CPP senza aumentare significativamente i costi perché il traffico è già segmentato.

## Variazioni Visive: Quale Elemento Ha Quale Impatto

Durante il creative test, gli elementi modificabili sono: icona, ordine degli screenshot, contenuto dello screenshot, app preview video, testo promozionale (su Play Store). Ogni elemento ha un impatto diverso sull'IPM. Una modifica dell'icona può generare incremento del %30-50 ma il rischio è alto — l'icona nuova potrebbe danneggiare il riconoscimento del brand, gli utenti esistenti non trovano l'app. Cambiare l'ordine degli screenshot è a basso rischio, medio impatto (%5-15 di uplift). Modificare il contenuto dello screenshot è ad alto impatto (%20-40 di uplift) ma il costo di design è elevato.

A seconda del genere di gioco, i temi di screenshot efficaci variano: negli RPG, progression del personaggio + showcase del loot; negli strategy, resource management + base building; nei puzzle casual, curva di difficoltà dei livelli. Nei giochi F2P, la combinazione "gameplay + meta progression" vince di solito — l'utente vede sia cosa gioca sia cosa guadagna. Nei giochi PvP hardcore, evidenziare l'elemento competitivo (leaderboard, torneo, badge di rank) aumenta la conversion.

## Attribution e Analisi di Coorte Post-Install

Il creative test non termina con l'IPM — devi monitorare anche le metriche di coorte dopo l'install. Se la variante CPP 1 aumenta l'IPM di %32 mentre la D7 retention scende del %12, c'è un mismatch tra ciò che la creativa promette e ciò che il gioco effettivamente offre. In questo caso, rivedi l'onboarding per allinearlo alla creativa o rendi la creativa più realistica.

Per l'attribution, su Apple Search Ads configura correttamente i postback SKAdNetwork — mappa il Conversion Value in base alla D1/D3/D7 retention. Su Play Store, utilizza Google Play Install Referrer API per taggare la sorgente della campagna, poi segmenta le coorti su Firebase o Adjust. Aggiungi l'ID della variante creativa come user property, così su BigQuery puoi scomporre l'analisi di coorte per creativa.

### Tabella di Coorte di Esempio

| Creativa | IPM | D1 Ret. | D7 Ret. | LTV D30 |
|----------|-----|---------|---------|---------|
| Default  | 48,2| 42%     | 18%     | $2,40   |
| Variante 1| 51,8| 44%     | 19%     | $2,55   |
| Variante 2| 63,4| 43%     | 17%     | $2,20   |

La Variante 2 vince su IPM ma D7 retention è bassa — questi utenti arrivano con aspettative ma rimangono delusi. La Variante 1 è equilibrata — aumenta sia l'IPM che la retention, impatta positivamente l'LTV. Questa va in produzione.

## Metodologia ASO di Roibase e Ciclo PPO

Il servizio [ASO](https://www.roibase.com.tr/it/aso) di Roibase integra il creative testing con il modello di attribution, costruendo il ciclo PPO (Product Page Optimization). Negli sprint di 6 settimane gestiamo keyword research + creative test + analisi di coorte post-install in modo iterativo. Nei giochi F2P mobile, questo ciclo funziona con parametri diversi nei Tier-1 market (US, UK, JP) rispetto ai market emergenti (TR, BR, IN) — ad esempio, in Turchia usare testo in turco nell'icona aumenta l'IPM del %18, negli USA ha effetto zero.

Il ciclo PPO comprende: (1) analisi dell'intent da keyword da GSC + App Store Connect, (2) formulare ipotesi creativa in base all'intent, (3) testare split A/B con CPP/Play Experiments, (4) verificare significatività statistica, (5) rendere la variante vincente il nuovo baseline e testare l'elemento successivo. Questo ciclo funziona con logica di continuous optimization — il test non finisce mai, ogni volta c'è un'opportunità di +%5-10 ulteriori.

---

Un processo di creative testing di 6 settimane richiede formulazione rigorosa di ipotesi e controllo statistico. Validare l'incremento di IPM con metriche post-install prima di passare in produzione è critico — altrimenti i guadagni di breve termine tornano indietro con churn di lungo termine. Le Custom Product Pages e Play Experiments sono i canali più controllabili per la crescita organica nel mobile gaming; ottimizzarli regolarmente con sprint strutturati è il percorso diretto per ridurre il costo di acquisition mantenendo LTV alto.