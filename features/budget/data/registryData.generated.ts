// AUTO-GENERATED — nepsat ručně. Rejstřík obcí z MONITOR (Státní pokladna),
// endpoint /api/kraj/obce?obdobi=2512&nuts=<kraj> (14 krajů, staženo 2026-07-30).
// Regenerace: lib/ingest/sources/monitor.ts → harvestMunicipalityRegistry()
// a packRegistry() z features/budget/mirrorData.ts.
// Formát řádku: ic|jméno|okres|indexKraje|obyvatelé — parser v mirrorData.ts.

/** Datum stažení rejstříku z MONITORu (zobrazuje se v provenienci plochy). */
export const REGISTRY_RETRIEVED_ON = "2026-07-30";

/** Období MONITORu, ke kterému se rejstřík váže (12/2025, FIN 2-12 M). */
export const REGISTRY_PERIOD_LABEL = "12/2025";

/** 14 krajů ČR — index v tabulce = číslo kraje v REGISTRY_PACKED. */
export const KRAJE: readonly { nuts: string; name: string }[] = [
  {
    "nuts": "CZ010",
    "name": "Hlavní město Praha"
  },
  {
    "nuts": "CZ020",
    "name": "Středočeský kraj"
  },
  {
    "nuts": "CZ031",
    "name": "Jihočeský kraj"
  },
  {
    "nuts": "CZ032",
    "name": "Plzeňský kraj"
  },
  {
    "nuts": "CZ041",
    "name": "Karlovarský kraj"
  },
  {
    "nuts": "CZ042",
    "name": "Ústecký kraj"
  },
  {
    "nuts": "CZ051",
    "name": "Liberecký kraj"
  },
  {
    "nuts": "CZ052",
    "name": "Královéhradecký kraj"
  },
  {
    "nuts": "CZ053",
    "name": "Pardubický kraj"
  },
  {
    "nuts": "CZ063",
    "name": "Kraj Vysočina"
  },
  {
    "nuts": "CZ064",
    "name": "Jihomoravský kraj"
  },
  {
    "nuts": "CZ071",
    "name": "Olomoucký kraj"
  },
  {
    "nuts": "CZ072",
    "name": "Zlínský kraj"
  },
  {
    "nuts": "CZ080",
    "name": "Moravskoslezský kraj"
  }
];

/** 6254 obcí ČR — jeden řádek na obec. */
export const REGISTRY_PACKED = `00064581|Hlavní město Praha|Hlavní město Praha|0|1397880
44992785|Brno|Brno - město|10|402739
00845451|Ostrava|Ostrava - město|13|283187
00075370|Plzeň|Plzeň - město|3|187928
00262978|Liberec|Liberec|6|108090
00299308|Olomouc|Olomouc|11|103063
00244732|České Budějovice|České Budějovice|2|97231
00268810|Hradec Králové|Hradec Králové|7|94311
00274046|Pardubice|Pardubice|8|92319
00081531|Ústí nad Labem|Ústí nad Labem|5|90866
00283924|Zlín|Zlín|12|74684
00234516|Kladno|Kladno|1|69664
00297488|Havířov|Karviná|13|68674
00266094|Most|Most|5|63474
00300535|Opava|Opava|13|55109
00286010|Jihlava|Jihlava|9|54624
00296643|Frýdek-Místek|Frýdek - Místek|13|53590
00266621|Teplice|Teplice|5|50912
00254657|Karlovy Vary|Karlovy Vary|4|49073
00297534|Karviná|Karviná|13|48937
00238295|Mladá Boleslav|Mladá Boleslav|1|47346
00261891|Chomutov|Chomutov|5|46771
00261238|Děčín|Děčín|5|46376
00262340|Jablonec nad Nisou|Jablonec nad Nisou|6|46209
00288659|Prostějov|Prostějov|11|43408
00301825|Přerov|Přerov|11|40906
00260428|Česká Lípa|Česká Lípa|6|36815
00290629|Třebíč|Třebíč|9|34530
00253014|Tábor|Tábor|2|34356
00293881|Znojmo|Znojmo|10|34172
00297313|Třinec|Frýdek - Místek|13|33852
00235440|Kolín|Kolín|1|33444
00253979|Cheb|Cheb|4|32808
00243132|Příbram|Příbram|1|32773
00249998|Písek|Písek|2|31121
00278360|Trutnov|Trutnov|7|29607
00287351|Kroměříž|Kroměříž|12|27917
00297577|Orlová|Karviná|13|27540
00304450|Vsetín|Vsetín|12|25185
00291471|Uherské Hradiště|Uherské Hradiště|12|24887
00303461|Šumperk|Šumperk|11|24735
00283061|Břeclav|Břeclav|10|24538
00267449|Havlíčkův Brod|Havlíčkův Brod|9|23791
00270211|Chrudim|Chrudim|8|23564
00284891|Hodonín|Hodonín|10|23517
00297437|Český Těšín|Karviná|13|23075
00298212|Nový Jičín|Nový Jičín|13|23005
00263958|Litoměřice|Litoměřice|5|22767
00255661|Klatovy|Klatovy|3|22763
00304387|Valašské Meziříčí|Vsetín|12|22580
00296139|Krnov|Bruntál|13|22518
00266027|Litvínov|Most|5|22387
00251810|Strakonice|Strakonice|2|22355
00259586|Sokolov|Sokolov|4|22007
00236195|Kutná Hora|Kutná Hora|1|21642
00233129|Beroun|Beroun|1|21521
00298077|Kopřivnice|Nový Jičín|13|21374
00292427|Vyškov|Vyškov|10|20645
00246875|Jindřichův Hradec|Jindřichův Hradec|2|20540
00295841|Žďár nad Sázavou|Žďár nad Sázavou|9|20404
00297569|Bohumín|Karviná|13|20315
00240079|Brandýs nad Labem-Stará Boleslav|Praha - východ|1|20313
00237051|Mělník|Mělník|1|20278
00279943|Blansko|Blansko|10|20002
00272868|Náchod|Náchod|7|19827
00261904|Jirkov|Chomutov|5|19240
00236977|Kralupy nad Vltavou|Mělník|1|19005
00265781|Žatec|Louny|5|18959
00261912|Kadaň|Chomutov|5|18090
00265209|Louny|Louny|5|18068
00301311|Hranice|Přerov|11|17969
00284301|Otrokovice|Zlín|12|17401
00240702|Říčany|Praha - východ|1|17143
00231401|Benešov|Benešov|1|17043
00234877|Slaný|Kladno|1|16937
00291463|Uherský Brod|Uherské Hradiště|12|16367
00237108|Neratovice|Mělník|1|16360
00248801|Pelhřimov|Pelhřimov|9|16206
00271632|Jičín|Jičín|7|16101
00277444|Svitavy|Svitavy|8|16073
00304271|Rožnov pod Radhoštěm|Vsetín|12|16063
00244309|Rakovník|Rakovník|1|15682
00254843|Ostrov|Karlovy Vary|4|15681
00239500|Nymburk|Nymburk|1|15642
00277819|Dvůr Králové nad Labem|Trutnov|7|15322
00239640|Poděbrady|Nymburk|1|15232
00295892|Bruntál|Bruntál|13|15037
00278653|Česká Třebová|Ústí nad Orlicí|8|15010
00261718|Varnsdorf|Děčín|5|14704
00276227|Turnov|Semily|6|14577
00266230|Bílina|Teplice|5|14497
00259047|Rokycany|Rokycany|3|14381
00239453|Milovice|Nymburk|1|14270
00260231|Tachov|Tachov|3|14097
00261939|Klášterec nad Ohří|Chomutov|5|14068
00254061|Mariánské Lázně|Cheb|4|14052
00279676|Ústí nad Orlicí|Ústí nad Orlicí|8|14011
00300063|Hlučín|Opava|13|13352
00303640|Zábřeh|Šumperk|11|13320
00299529|Šternberk|Olomouc|11|13239
00245836|Český Krumlov|Český Krumlov|2|12797
00266418|Krupka|Teplice|5|12793
00253901|Aš|Cheb|4|12684
00264334|Roudnice nad Labem|Litoměřice|5|12668
00259349|Chodov|Sokolov|4|12609
00279773|Vysoké Mýto|Ústí nad Orlicí|8|12560
00279978|Boskovice|Blansko|10|12508
00272728|Jaroměř|Náchod|7|12483
00240117|Čelákovice|Praha - východ|1|12474
00278475|Vrchlabí|Trutnov|7|12102
00281964|Kuřim|Brno - venkov|10|11860
00287172|Holešov|Kroměříž|12|11616
00295671|Velké Meziříčí|Žďár nad Sázavou|9|11608
00248266|Humpolec|Pelhřimov|9|11522
00232947|Vlašim|Benešov|1|11434
00275336|Rychnov nad Kněžnou|Rychnov nad Kněžnou|7|11420
00260771|Nový Bor|Česká Lípa|6|11318
00299634|Uničov|Olomouc|11|11237
00253316|Domažlice|Domažlice|3|11133
00250627|Prachatice|Prachatice|2|11119
00261602|Rumburk|Děčín|5|10815
00256129|Sušice|Klatovy|3|10740
00285030|Kyjov|Hodonín|10|10645
00285455|Veselí nad Moravou|Hodonín|10|10623
00509701|Králův Dvůr|Beroun|1|10598
00297852|Frenštát pod Radhoštěm|Nový Jičín|13|10554
00241318|Jesenice|Praha - západ|1|10460
00302724|Jeseník|Jeseník|11|10456
00276944|Litomyšl|Svitavy|8|10448
00236021|Čáslav|Kutná Hora|1|10399
00274101|Přelouč|Pardubice|8|10203
00239402|Lysá nad Labem|Nymburk|1|10004
00281859|Ivančice|Brno - venkov|10|9898
00296651|Frýdlant nad Ostravicí|Frýdek - Místek|13|9835
00294900|Nové na Moravě|Žďár nad Sázavou|9|9834
00303038|Mohelnice|Šumperk|11|9782
00279102|Lanškroun|Ústí nad Orlicí|8|9776
00270059|Hlinsko|Chrudim|8|9563
00277037|Moravská Třebová|Svitavy|8|9550
00299138|Litovel|Olomouc|11|9510
00298441|Studénka|Nový Jičín|13|9302
00282707|Tišnov|Brno - venkov|10|9225
00272876|Nové nad Metují|Náchod|7|9181
00241237|Hostivice|Praha - západ|1|9179
00267538|Chotěboř|Havlíčkův Brod|9|9092
00241610|Roztoky|Praha - západ|1|9088
00277177|Polička|Svitavy|8|9051
00238309|Mnichovo Hradiště|Mladá Boleslav|1|9048
00271888|Nová Paka|Jičín|7|8979
00242098|Dobříš|Příbram|1|8870
00263991|Lovosice|Litoměřice|5|8727
00266299|Duchcov|Teplice|5|8695
00278955|Choceň|Ústí nad Orlicí|8|8641
00264466|Štětí|Litoměřice|5|8553
00271560|Hořice|Jičín|7|8476
00298328|Příbor|Nový Jičín|13|8298
00247618|Třeboň|Jindřichův Hradec|2|8270
00272566|Červený Kostelec|Náchod|7|8262
00266281|Dubí|Teplice|5|8114
00260177|Stříbro|Tachov|3|8060
00233242|Hořovice|Beroun|1|8055
00276111|Semily|Semily|6|8022
00287113|Bystřice pod Hostýnem|Kroměříž|12|8002
00262854|Hrádek nad Nisou|Liberec|6|8001
00301493|Lipník nad Bečvou|Přerov|11|7955
00249831|Milevsko|Písek|2|7950
00282651|Šlapanice|Brno - venkov|10|7915
00237442|Benátky nad Jizerou|Mladá Boleslav|1|7879
00294136|Bystřice nad Pernštejnem|Žďár nad Sázavou|9|7871
00297615|Rychvald|Karviná|13|7787
00245585|Týn nad Vltavou|České Budějovice|2|7774
00296317|Rýmařov|Bruntál|13|7763
00254801|Nejdek|Karlovy Vary|4|7733
00241121|Černošice|Praha - západ|1|7712
00283347|Mikulov|Břeclav|10|7577
00245941|Kaplice|Český Krumlov|2|7531
00240931|Úvaly|Praha - východ|1|7515
00235334|Český Brod|Kolín|1|7487
00297372|Vratimov|Ostrava - město|13|7434
00297755|Bílovec|Nový Jičín|13|7411
00297593|Petřvald|Karviná|13|7409
00251984|Vodňany|Strakonice|2|7383
00262781|Frýdlant|Liberec|6|7379
00298221|Odry|Nový Jičín|13|7314
00250805|Vimperk|Prachatice|2|7289
00292311|Slavkov u Brna|Vyškov|10|7258
00269247|Nový Bydžov|Hradec Králové|7|7224
00246476|Dačice|Jindřichův Hradec|2|7157
00280518|Letovice|Blansko|10|7124
00272523|Broumov|Náchod|7|7108
00289931|Moravské Budějovice|Třebíč|9|7098
00252859|Sezimovo Ústí|Tábor|2|7097
00252921|Soběslav|Tábor|2|7070
00284220|Napajedla|Zlín|12|7043
00258199|Nýřany|Plzeň - sever|3|6991
00291676|Bučovice|Vyškov|10|6891
00257125|Přeštice|Plzeň - jih|3|6792
00282481|Rosice|Brno - venkov|10|6784
00243272|Sedlčany|Příbram|1|6767
00273571|Holice|Pardubice|8|6761
00300292|Kravaře|Opava|13|6689
00250996|Blatná|Strakonice|2|6669
00297291|Šenov|Ostrava - město|13|6639
00567884|Staré Město|Uherské Hradiště|12|6585
00240559|Odolena Voda|Praha - východ|1|6547
00274879|Dobruška|Rychnov nad Kněžnou|7|6532
00253081|Veselí nad Lužnicí|Tábor|2|6515
00256552|Dobřany|Plzeň - jih|3|6504
00259438|Kraslice|Sokolov|4|6432
00242748|Mníšek pod Brdy|Praha - západ|1|6432
00287229|Hulín|Kroměříž|12|6414
00279129|Letohrad|Ústí nad Orlicí|8|6407
00268321|Světlá nad Sázavou|Havlíčkův Brod|9|6394
00283193|Hustopeče|Břeclav|10|6388
00260746|Mimoň|Česká Lípa|6|6387
00262871|Chrastava|Liberec|6|6315
00265365|Podbořany|Louny|5|6253
00274968|Kostelec nad Orlicí|Rychnov nad Kněžnou|7|6252
00284882|Dubňany|Hodonín|10|6202
00284459|Slavičín|Zlín|12|6184
00275468|Týniště nad Orlicí|Rychnov nad Kněžnou|7|6148
00283509|Pohořelice|Brno - venkov|10|6126
00272680|Hronov|Náchod|7|6094
00262633|Železný Brod|Jablonec nad Nisou|6|6043
00262587|Tanvald|Jablonec nad Nisou|6|5970
00292281|Rousínov|Vyškov|10|5962
00269719|Třebechovice pod Orebem|Hradec Králové|7|5869
00279846|Žamberk|Ústí nad Orlicí|8|5819
00286753|Třešť|Jihlava|9|5790
00282103|Modřice|Brno - venkov|10|5755
00232904|Týnec nad Sázavou|Benešov|1|5752
00301370|Kojetín|Přerov|11|5748
00244155|Nové Strašecí|Rakovník|1|5686
00293199|Moravský Krumlov|Znojmo|10|5667
00253367|Holýšov|Plzeň - jih|3|5647
00261688|Šluknov|Děčín|5|5629
00244899|Hluboká nad Vltavou|České Budějovice|2|5626
00275905|Lomnice nad Popelkou|Semily|6|5626
00268861|Chlumec nad Cidlinou|Hradec Králové|7|5609
00253936|Františkovy Lázně|Cheb|4|5607
00567892|Kunovice|Uherské Hradiště|12|5570
00304492|Zubří|Vsetín|12|5561
00300870|Vítkov|Opava|13|5508
00233773|Rudná|Praha - západ|1|5502
00241229|Horoměřice|Praha - západ|1|5496
00260096|Planá|Tachov|3|5493
00295647|Velká Bíteš|Žďár nad Sázavou|9|5482
00297861|Fulnek|Nový Jičín|13|5472
00300144|Hradec nad Moravicí|Opava|13|5459
00278386|Úpice|Trutnov|7|5448
00257257|Starý Plzenec|Plzeň - město|3|5403
00283819|Brumov - Bylnice|Zlín|12|5400
00275808|Jilemnice|Semily|6|5377
00237418|Bakov nad Jizerou|Mladá Boleslav|1|5355
00234923|Stochov|Kladno|1|5349
00297461|Dolní Lutyně|Karviná|13|5326
00285315|Strážnice|Hodonín|10|5311
00259322|Horní Slavkov|Sokolov|4|5309
00235075|Unhošť|Kladno|1|5292
00286435|Polná|Jihlava|9|5277
00241326|Jílové u Prahy|Praha - západ|1|5262
00245551|Trhové Sviny|České Budějovice|2|5262
00296562|Bystřice|Frýdek - Místek|13|5260
00296759|Jablunkov|Frýdek - Místek|13|5257
00508870|Kosmonosy|Mladá Boleslav|1|5247
00240273|Kamenice|Praha - východ|1|5187
00253464|Kdyně|Domažlice|3|5153
00286745|Telč|Jihlava|9|5134
00260444|Doksy|Česká Lípa|6|5115
00255513|Horažďovice|Klatovy|3|5103
00258415|Třemošná|Plzeň - sever|3|5052
00253383|Horšovský Týn|Domažlice|3|5046
00261220|Česká Kamenice|Děčín|5|5037
00284165|Luhačovice|Zlín|12|5029
00272591|Česká Skalice|Náchod|7|5020
00270903|Skuteč|Chrudim|8|5020
00255921|Nýrsko|Klatovy|3|5011
00300390|Ludgeřovice|Opava|13|4989
00297585|Petrovice u Karviné|Karviná|13|4971
00241296|Chýně|Praha - západ|1|4965
00270041|Heřmanův Městec|Chrudim|8|4964
00261408|Jílové|Děčín|5|4932
00259713|Bor|Tachov|3|4889
00297666|Těrlicko|Karviná|13|4877
00239607|Pečky|Kolín|1|4874
00282286|Oslavany|Brno - venkov|10|4873
00284611|Valašské Klobouky|Zlín|12|4864
00284653|Vizovice|Zlín|12|4845
00252069|Bechyně|Tábor|2|4815
00237434|Bělá pod Bezdězem|Mladá Boleslav|1|4804
00289965|Náměšť nad Oslavou|Třebíč|9|4767
00250023|Protivín|Písek|2|4764
00232963|Votice|Benešov|1|4760
00236667|Zruč nad Sázavou|Kutná Hora|1|4755
00267759|Ledeč nad Sázavou|Havlíčkův Brod|9|4749
00248789|Pacov|Pelhřimov|9|4743
00241202|Dolní Břežany|Praha - západ|1|4735
00296457|Vrbno pod Pradědem|Bruntál|13|4714
00231525|Bystřice|Benešov|1|4698
00259314|Habartov|Sokolov|4|4691
00245178|Lišov|České Budějovice|2|4679
00265403|Postoloprty|Louny|5|4673
00287245|Chropyně|Kroměříž|12|4642
00258474|Vejprnice|Plzeň - sever|3|4617
00279889|Adamov|Blansko|10|4616
00252654|Planá nad Lužnicí|Tábor|2|4614
00266086|Meziboří|Most|5|4597
00275492|Vamberk|Rychnov nad Kněžnou|7|4568
00284807|Bzenec|Hodonín|10|4561
00260410|Cvikov|Česká Lípa|6|4534
00299847|Bolatice|Opava|13|4530
00259454|Kynšperk nad Ohří|Sokolov|4|4527
00266558|Osek|Teplice|5|4516
00297445|Dětmarovice|Karviná|13|4511
63026112|Vendryně|Frýdek - Místek|13|4507
00285498|Vracov|Hodonín|10|4496
00236951|Kostelec nad Labem|Mělník|1|4462
00298051|Klimkovice|Ostrava - město|13|4454
00274241|Sezemice|Pardubice|8|4451
00290807|Bojkovice|Uherské Hradiště|12|4422
00240524|Nehvizdy|Praha - východ|1|4404
00575917|Horní Suchá|Karviná|13|4320
00254819|Nová Role|Karlovy Vary|4|4277
00391387|Chlumec|Ústí nad Labem|5|4257
00290939|Hluk|Uherské Hradiště|12|4254
00241580|Psáry|Praha - západ|1|4254
00243221|Rožmitál pod Třemšínem|Příbram|1|4244
00291480|Uherský Ostroh|Uherské Hradiště|12|4209
00256455|Blovice|Plzeň - jih|3|4207
00298891|Hlubočky|Olomouc|11|4207
00240851|Šestajovice|Praha - východ|1|4199
00244686|Borovany|České Budějovice|2|4184
00296538|Brušperk|Frýdek - Místek|13|4164
00270920|Slatiňany|Chrudim|8|4163
00235474|Kostelec nad Černými lesy|Praha - východ|1|4156
00240478|Mnichovice|Praha - východ|1|4156
00277908|Hostinné|Trutnov|7|4151
00282456|Rajhrad|Brno - venkov|10|4136
00272949|Police nad Metují|Náchod|7|4131
00234061|Zdice|Beroun|1|4124
00279072|Králíky|Ústí nad Orlicí|8|4097
00241032|Zdiby|Praha - východ|1|4097
00289507|Jaroměřice nad Rokytnou|Třebíč|9|4087
00268097|Přibyslav|Havlíčkův Brod|9|4076
00257770|Horní Bříza|Plzeň - sever|3|4066
00296511|Baška|Frýdek - Místek|13|4032
00234214|Buštěhrad|Kladno|1|3995
00289531|Jemnice|Třebíč|9|3964
00285242|Ratíškovice|Hodonín|10|3955
00240290|Klecany|Praha - východ|1|3938
00262579|Smržovka|Jablonec nad Nisou|6|3915
00297062|Paskov|Frýdek - Místek|13|3883
60781688|Návsí|Frýdek - Místek|13|3880
00299979|Dolní Benešov|Opava|13|3869
00236411|Sázava|Benešov|1|3867
00246174|Velešín|Český Krumlov|2|3861
00283673|Velké Bílovice|Břeclav|10|3854
00260967|Stráž pod Ralskem|Česká Lípa|6|3839
00283916|Fryšták|Zlín|12|3834
00285668|Brtnice|Jihlava|9|3817
00260622|Kamenický Šenov|Česká Lípa|6|3811
00297429|Albrechtice|Karviná|13|3808
00299651|Velká Bystřice|Olomouc|11|3779
00241636|Řevnice|Praha - západ|1|3777
00241181|Dobřichovice|Praha - západ|1|3772
00266035|Lom|Most|5|3762
00246182|Větřní|Český Krumlov|2|3761
00280836|Rájec - Jestřebí|Blansko|10|3736
00285145|Mutěnice|Hodonín|10|3735
00281581|Bílovice nad Svitavou|Brno - venkov|10|3725
00263036|Nové pod Smrkem|Liberec|6|3725
00260576|Jablonné v Podještědí|Liberec|6|3704
00296481|Zlaté Hory|Jeseník|11|3701
00250830|Volary|Prachatice|2|3692
00282979|Židlochovice|Brno - venkov|10|3676
00271730|Lázně Bělohrad|Jičín|7|3674
00237663|Dobrovice|Mladá Boleslav|1|3671
00282928|Zbýšov|Brno - venkov|10|3671
00248380|Kamenice nad Lipou|Pelhřimov|9|3651
00296953|Mosty u Jablunkova|Frýdek - Místek|13|3649
00303089|Nový Malín|Šumperk|11|3647
00257265|Stod|Plzeň - jih|3|3646
00283321|Lanžhot|Břeclav|10|3637
00246433|České Velenice|Jindřichův Hradec|2|3607
00241407|Libčice nad Vltavou|Praha - západ|1|3604
00241806|Velké Přílepy|Praha - západ|1|3601
00247561|Suchdol nad Lužnicí|Jindřichův Hradec|2|3597
00283665|Valtice|Břeclav|10|3580
00242004|Březnice|Příbram|1|3577
00256986|Nepomuk|Plzeň - jih|3|3562
00234630|Libušín|Kladno|1|3555
00299511|Štěpánov|Olomouc|11|3555
00282120|Moravany|Brno - venkov|10|3554
00285358|Svatobořice-Mistřín|Hodonín|10|3549
00297054|Palkovice|Frýdek - Místek|13|3535
00261181|Benešov nad Ploučnicí|Děčín|5|3526
00281824|Hrušovany u Brna|Brno - venkov|10|3518
00282804|Veverská Bítýška|Brno - venkov|10|3512
00261424|Jiříkov|Děčín|5|3507
00258563|Zruč-Senec|Plzeň - sever|3|3494
00488526|Rohatec|Hodonín|10|3474
00298468|Štramberk|Nový Jičín|13|3470
00255076|Toužim|Karlovy Vary|4|3465
00281247|Velké Opatovice|Blansko|10|3457
00245721|Zliv|České Budějovice|2|3453
00257966|Kralovice|Plzeň - sever|3|3450
00291200|Ostrožská Nová Ves|Uherské Hradiště|12|3401
00253766|Staňkov|Domažlice|3|3401
00258385|Tlučná|Plzeň - sever|3|3390
00263931|Libochovice|Litoměřice|5|3388
00674010|Trmice|Ústí nad Labem|5|3381
00291170|Nivnice|Uherské Hradiště|12|3378
00292877|Hrušovany nad Jevišovkou|Znojmo|10|3377
00296228|Albrechtice|Bruntál|13|3375
00282740|Újezd u Brna|Brno - venkov|10|3375
00273350|Lázně Bohdaneč|Pardubice|8|3355
00261459|Krásná Lípa|Děčín|5|3341
00291340|Strání|Uherské Hradiště|12|3341
00240966|Velké Popovice|Praha - východ|1|3329
00635901|Rapotín|Šumperk|11|3316
00271071|Třemošnice|Chrudim|8|3314
00240427|Líbeznice|Praha - východ|1|3301
00239721|Sadská|Nymburk|1|3301
00282618|Střelice|Brno - venkov|10|3283
00296589|Dobrá|Frýdek - Místek|13|3263
00302899|Libina|Šumperk|11|3254
00240257|Jirny|Praha - východ|1|3253
00300021|Háj ve Slezsku|Opava|13|3239
00266400|Košťany|Teplice|5|3239
00299669|Velký Týnec|Olomouc|11|3205
00247138|Nová Bystřice|Jindřichův Hradec|2|3199
00300241|Kobeřice|Opava|13|3197
00507644|Vestec|Praha - západ|1|3195
00241041|Zeleneč|Praha - východ|1|3178
00249505|Žirovnice|Pelhřimov|9|3178
00286192|Luka nad Jihlavou|Jihlava|9|3172
00300756|Štěpánkovice|Opava|13|3160
00270199|Chrast|Chrudim|8|3150
00275191|Opočno|Rychnov nad Kněžnou|7|3148
00269557|Smiřice|Hradec Králové|7|3138
00296821|Kozlovice|Frýdek - Místek|13|3135
00231584|Čerčany|Benešov|1|3133
00299189|Lutín|Olomouc|11|3132
00236527|Uhlířské Janovice|Kutná Hora|1|3131
00236616|Vrdy|Kutná Hora|1|3118
00283703|Velké Pavlovice|Břeclav|10|3100
00257893|Kaznějov|Plzeň - sever|3|3085
00304476|Zašová|Vsetín|12|3084
00268542|Ždírec nad Doubravou|Havlíčkův Brod|9|3083
00235105|Velvary|Kladno|1|3080
00258555|Zbůch|Plzeň - sever|3|3080
00278963|Jablonné nad Orlicí|Ústí nad Orlicí|8|3078
00284858|Dolní Bojanovice|Hodonín|10|3076
00278491|Žacléř|Trutnov|7|3072
00240036|Bašť|Praha - východ|1|3068
00293164|Miroslav|Znojmo|10|3054
00302945|Loštice|Šumperk|11|3052
00259489|Loket|Sokolov|4|3050
00256706|Chotěšov|Plzeň - jih|3|3048
00252000|Volyně|Strakonice|2|3036
00240508|Mukařov|Praha - východ|1|3024
00237680|Dolní Bousov|Mladá Boleslav|1|3011
00257249|Spálené Poříčí|Plzeň - jih|3|3008
00262307|Desná|Jablonec nad Nisou|6|2999
00280283|Jedovnice|Blansko|10|2999
00245445|Srubec|České Budějovice|2|2998
00302368|Bludov|Šumperk|11|2996
00262820|Hodkovice nad Mohelkou|Liberec|6|2994
00297232|Stará Ves nad Ondřejnicí|Ostrava - město|13|2992
00245950|Křemže|Český Krumlov|2|2989
00298425|Starý Jičín|Nový Jičín|13|2987
00232645|Sedlec-Prčice|Příbram|1|2979
00291846|Ivanovice na Hané|Vyškov|10|2978
00287504|Morkovice-Slížany|Kroměříž|12|2975
00303232|Postřelmov|Šumperk|11|2962
00298808|Dolany|Olomouc|11|2961
00291561|Vlčnov|Uherské Hradiště|12|2956
00278637|Červená Voda|Ústí nad Orlicí|8|2954
00261114|Zákupy|Česká Lípa|6|2954
00284475|Slušovice|Zlín|12|2945
00283495|Podivín|Břeclav|10|2938
00296571|Čeladná|Frýdek - Místek|13|2931
00273660|Chvaletice|Pardubice|8|2925
00258245|Plasy|Plzeň - sever|3|2924
00282278|Ořechov|Brno - venkov|10|2915
00285480|Vnorovy|Hodonín|10|2914
00274011|Opatovice nad Labem|Pardubice|8|2912
00282111|Mokrá - Horákov|Brno - venkov|10|2908
00255050|Teplá|Cheb|4|2903
00257290|Šťáhlavy|Plzeň - město|3|2901
00240788|Strančice|Praha - východ|1|2899
44164343|Lužice|Hodonín|10|2894
00280470|Kunštát|Blansko|10|2891
00302546|Hanušovice|Šumperk|11|2889
00258059|Líně|Plzeň - sever|3|2886
00262722|Český Dub|Liberec|6|2882
00239437|Městec Králové|Nymburk|1|2878
00295906|Břidličná|Bruntál|13|2874
00290904|Dolní Němčí|Uherské Hradiště|12|2866
00278238|Rtyně v Podkrkonoší|Trutnov|7|2858
00262552|Rychnov u Jablonce nad Nisou|Jablonec nad Nisou|6|2854
00298450|Suchdol nad Odrou|Nový Jičín|13|2850
00264474|Terezín|Litoměřice|5|2850
00241563|Průhonice|Praha - západ|1|2846
00264571|Úštěk|Litoměřice|5|2844
00263141|Raspenava|Liberec|6|2833
00288373|Kostelec na Hané|Prostějov|11|2832
00276791|Jevíčko|Svitavy|8|2822
00267406|Golčův Jeníkov|Havlíčkův Brod|9|2821
00298581|Vřesina|Ostrava - město|13|2820
00259098|Strašice|Rokycany|3|2811
00296244|Moravský Beroun|Olomouc|11|2804
00299898|Budišov nad Budišovkou|Opava|13|2801
00245194|Litvínovice|České Budějovice|2|2793
00235041|Tuchlovice|Kladno|1|2792
00285447|Velká nad Veličkou|Hodonín|10|2791
00259551|Rotava|Sokolov|4|2778
00262170|Vejprty|Chomutov|5|2766
00232386|Neveklov|Benešov|1|2764
00298514|Trojanovice|Nový Jičín|13|2758
00258725|Hrádek|Rokycany|3|2754
00262803|Hejnice|Liberec|6|2751
00287334|Koryčany|Kroměříž|12|2732
00262595|Velké Hamry|Jablonec nad Nisou|6|2717
00252557|Mladá Vožice|Tábor|2|2705
00241831|Vrané nad Vltavou|Praha - západ|1|2704
00266566|Proboštov|Teplice|5|2700
00245062|Kamenný Újezd|České Budějovice|2|2694
00273481|Dašice|Pardubice|8|2692
00298948|Horka nad Moravou|Olomouc|11|2679
00303925|Kelč|Vsetín|12|2673
00259250|Březová|Sokolov|4|2664
00288365|Konice|Prostějov|11|2664
00283363|Moravská Nová Ves|Břeclav|10|2659
00581232|Dobrá Voda u Českých Budějovic|České Budějovice|2|2652
00240818|Sulice|Praha - východ|1|2635
00235873|Velký Osek|Kolín|1|2619
00270440|Luže|Chrudim|8|2604
00278742|Dolní Dobrouč|Ústí nad Orlicí|8|2597
00246191|Vyšší Brod|Český Krumlov|2|2597
00245381|Rudolfov|České Budějovice|2|2587
00302708|Javorník|Jeseník|11|2574
00237221|Tišice|Mělník|1|2574
00281701|Dolní Kounice|Brno - venkov|10|2571
00240214|Hovorčovice|Praha - východ|1|2571
00252387|Chýnov|Tábor|2|2568
00296686|Horní Bludovice|Karviná|13|2564
00635511|Hať|Opava|13|2558
00297046|Ostravice|Frýdek - Místek|13|2556
00303313|Ruda nad Moravou|Šumperk|11|2549
00556912|Chabařovice|Ústí nad Labem|5|2545
00245135|Ledenice|České Budějovice|2|2544
00285536|Ždánice|Hodonín|10|2543
00259225|Zbiroh|Rokycany|3|2541
00298697|Bohuňovice|Olomouc|11|2534
00259527|Nové Sedlo|Sokolov|4|2527
00242381|Jince|Příbram|1|2524
00303551|Velké Losiny|Šumperk|11|2511
00269191|Nechanice|Hradec Králové|7|2508
00237329|Všetaty|Mělník|1|2506
00248843|Počátky|Pelhřimov|9|2502
00241245|Hradištko|Praha - západ|1|2499
00488399|Zastávka|Brno - venkov|10|2495
00282596|Sokolnice|Brno - venkov|10|2490
00303003|Mikulovice|Jeseník|11|2482
00304131|Nový Hrozenkov|Vsetín|12|2478
00276057|Rokytnice nad Jizerou|Semily|6|2478
00283258|Klobouky u Brna|Břeclav|10|2476
00268674|Černilov|Hradec Králové|7|2469
00245267|Nové Hrady|České Budějovice|2|2469
00250601|Netolice|Prachatice|2|2467
00302082|Tovačov|Přerov|11|2467
00255611|Janovice nad Úhlavou|Klatovy|3|2464
00296856|Kunčice pod Ondřejníkem|Frýdek - Místek|13|2460
00283720|Vranovice|Brno - venkov|10|2446
00258105|Touškov|Plzeň - sever|3|2444
00256650|Chlumčany|Plzeň - jih|3|2442
00662241|Libiš|Mělník|1|2442
00284572|Tlumačov|Zlín|12|2439
00303771|Horní Bečva|Vsetín|12|2438
00285595|Batelov|Jihlava|9|2437
00267139|Velké Březno|Ústí nad Labem|5|2433
00671916|Stráž nad Nisou|Liberec|6|2430
00233382|Komárov|Beroun|1|2426
00296635|Fryčovice|Frýdek - Místek|13|2425
00233668|Nučice|Praha - západ|1|2424
00240656|Přezletice|Praha - východ|1|2419
00263362|Bohušovice nad Ohří|Litoměřice|5|2415
00282375|Pozořice|Brno - venkov|10|2413
00291731|Drnovice|Vyškov|10|2405
00572756|Velká Hleďsebe|Cheb|4|2402
00272124|Sobotka|Jičín|7|2400
00290866|Buchlovice|Uherské Hradiště|12|2397
00282723|Troubsko|Brno - venkov|10|2397
00298191|Mořkov|Nový Jičín|13|2383
00275417|Solnice|Rychnov nad Kněžnou|7|2376
00304417|Velké Karlovice|Vsetín|12|2376
00303909|Karolinka|Vsetín|12|2373
00265080|Kryry|Louny|5|2361
00284823|Čejkovice|Hodonín|10|2359
00296848|Krmelín|Frýdek - Místek|13|2356
00303801|Hovězí|Vsetín|12|2355
00241342|Jinočany|Praha - západ|1|2350
00303763|Halenkov|Vsetín|12|2348
00265331|Peruc|Louny|5|2347
00257303|Štěnovice|Plzeň - jih|3|2341
00238023|Kněžmost|Mladá Boleslav|1|2331
00654451|Velké Poříčí|Náchod|7|2328
00272841|Meziměstí|Náchod|7|2324
00238252|Luštěnice|Mladá Boleslav|1|2318
00237272|Veltrusy|Mělník|1|2311
00270156|Hrochův Týnec|Chrudim|8|2307
00258628|Břasy|Rokycany|3|2305
00254622|Jáchymov|Karlovy Vary|4|2304
00636037|Česká Ves|Jeseník|11|2303
00298654|Bělkovice-Lašťany|Olomouc|11|2302
00240664|Pyšely|Benešov|1|2301
00234168|Brandýsek|Kladno|1|2300
00235172|Zlonice|Kladno|1|2294
00635898|Vikýřovice|Šumperk|11|2289
00278149|Mladé Buky|Trutnov|7|2287
00303798|Hošťálková|Vsetín|12|2283
00281611|Blučina|Brno - venkov|10|2277
00266931|Povrly|Ústí nad Labem|5|2277
00245607|Včelná|České Budějovice|2|2274
45670773|Dobšice|Znojmo|10|2272
00283568|Rakvice|Břeclav|10|2267
00243981|Lány|Kladno|1|2262
00233307|Hýskov|Beroun|1|2259
00240869|Škvorec|Praha - východ|1|2259
00288632|Plumlov|Prostějov|11|2254
00258890|Mirošov|Rokycany|3|2248
00234079|Žebrák|Beroun|1|2248
00576956|Staříč|Frýdek - Místek|13|2238
00247456|Slavonice|Jindřichův Hradec|2|2229
00846872|Sviadnov|Frýdek - Místek|13|2229
00235865|Velim|Kolín|1|2222
00246905|Kardašova Řečice|Jindřichův Hradec|2|2221
00831514|Ralsko|Česká Lípa|6|2220
00304352|Valašská Bystřice|Vsetín|12|2218
00237094|Nelahozeves|Mělník|1|2213
00241725|Štěchovice|Praha - západ|1|2212
00300411|Markvartovice|Opava|13|2211
00235831|Týnec nad Labem|Kolín|1|2211
00299260|Náměšť na Hané|Olomouc|11|2210
00242730|Milín|Příbram|1|2209
00296007|Horní Benešov|Bruntál|13|2205
00290823|Boršice|Uherské Hradiště|12|2199
00300829|Velká Polom|Ostrava - město|13|2194
00254053|Luby|Cheb|4|2191
00247545|Studená|Jindřichův Hradec|2|2190
00287385|Kvasice|Kroměříž|12|2189
00255181|Žlutice|Karlovy Vary|4|2187
00297194|Hukvaldy|Frýdek - Místek|13|2185
00285226|Prušánky|Hodonín|10|2183
00240451|Měšice|Praha - východ|1|2181
00290785|Bánov|Uherské Hradiště|12|2178
00241211|Holubice|Praha - západ|1|2176
00265942|Horní Jiřetín|Most|5|2176
00247146|Nová Včelnice|Jindřichův Hradec|2|2176
00303828|Huslenky|Vsetín|12|2174
00269611|Stěžery|Hradec Králové|7|2174
00283339|Lednice|Břeclav|10|2170
00254592|Hroznětín|Karlovy Vary|4|2162
00285439|Vacenovice|Hodonín|10|2162
01265750|Krhová|Vsetín|12|2161
00274305|Staré Hradiště|Pardubice|8|2161
00263427|Budyně nad Ohří|Litoměřice|5|2159
00234427|Hřebeč|Kladno|1|2159
00271705|Kopidlno|Jičín|7|2157
00272132|Stará Paka|Jičín|7|2156
00235954|Zásmuky|Kolín|1|2156
00242888|Nový Knín|Příbram|1|2154
00284904|Hovorany|Hodonín|10|2153
00300667|Slavkov|Opava|13|2153
00285374|Šardice|Hodonín|10|2152
00282537|Říčany|Brno - venkov|10|2143
00235113|Vinařice|Kladno|1|2137
00297330|Václavovice|Ostrava - město|13|2136
00233641|Nižbor|Beroun|1|2133
00266531|Novosedlice|Teplice|5|2133
00252425|Jistebnice|Tábor|2|2132
00283622|Šitbořice|Břeclav|10|2126
00275301|Rokytnice v Orlických horách|Rychnov nad Kněžnou|7|2125
00270741|Proseč|Chrudim|8|2124
00273503|Dolní Roveň|Pardubice|8|2123
00640816|Nupaky|Praha - východ|1|2121
00273589|Horní Jelení|Pardubice|8|2119
00257745|Dýšina|Plzeň - město|3|2112
00280097|Černá Hora|Blansko|10|2110
00244694|Boršov nad Vltavou|České Budějovice|2|2105
00281727|Drásov|Brno - venkov|10|2103
00284556|Štítná nad Vláří-Popov|Zlín|12|2103
00300560|Píšť|Opava|13|2098
00303992|Lešná|Vsetín|12|2097
00282634|Syrovice|Brno - venkov|10|2097
00262501|Pěnčín|Jablonec nad Nisou|6|2096
00261581|Mikulášovice|Děčín|5|2092
00240206|Horoušany|Praha - východ|1|2088
60798432|Šenov u Nového Jičína|Nový Jičín|13|2085
00640042|Květnice|Praha - východ|1|2081
00287938|Zdounky|Kroměříž|12|2077
00253961|Hranice|Cheb|4|2070
00283690|Velké Němčice|Břeclav|10|2070
00291943|Křenovice|Vyškov|10|2068
00283631|Tvrdonice|Břeclav|10|2067
00241946|Bohutín|Příbram|1|2063
00303852|Jablůnka|Vsetín|12|2063
00274739|Borohrádek|Rychnov nad Kněžnou|7|2062
00577006|Raškovice|Frýdek - Místek|13|2062
00492868|Nýdek|Frýdek - Místek|13|2060
00250546|Lhenice|Prachatice|2|2052
00266116|Obrnice|Most|5|2049
00302929|Lipová-lázně|Jeseník|11|2047
00233510|Loděnice|Beroun|1|2040
00291251|Polešovice|Uherské Hradiště|12|2036
00240940|Veleň|Praha - východ|1|2036
00283932|Halenkovice|Zlín|12|2029
00285137|Moravský Písek|Hodonín|10|2028
00274810|České Meziříčí|Rychnov nad Kněžnou|7|2027
00290050|Okříšky|Třebíč|9|2018
00235326|Červené Pečky|Kolín|1|2016
00281999|Lelekovice|Brno - venkov|10|2016
00234788|Pchery|Kladno|1|2015
00261734|Velký Šenov|Děčín|5|2013
00298476|Tichá|Nový Jičín|13|2012
00294799|Měřín|Žďár nad Sázavou|9|2011
00493619|Janovice|Frýdek - Místek|13|2010
63028255|Křelov-Břuchotín|Olomouc|11|2009
00302104|Troubky|Přerov|11|2009
00240621|Postřižín|Mělník|1|2007
00234010|Vysoký Újezd|Beroun|1|1995
00286079|Kamenice|Jihlava|9|1994
00259861|Chodová Planá|Tachov|3|1990
00266337|Hrob|Teplice|5|1990
00278246|Rudník|Trutnov|7|1989
00235482|Kouřim|Kolín|1|1984
00244031|Lužná|Rakovník|1|1984
00283266|Kobylí|Břeclav|10|1983
00234893|Smečno|Kladno|1|1980
00281662|Čebín|Brno - venkov|10|1978
00298531|Veřovice|Nový Jičín|13|1978
00268356|Štoky|Havlíčkův Brod|9|1975
00298794|Dlouhá Loučka|Olomouc|11|1974
00303836|Hutisko - Solanec|Vsetín|12|1974
00285102|Mikulčice|Hodonín|10|1973
00269379|Předměřice nad Labem|Hradec Králové|7|1972
00245933|Kájov|Český Krumlov|2|1971
00280615|Lysice|Blansko|10|1966
00573213|Dalovice|Karlovy Vary|4|1964
00241890|Zvole|Praha - západ|1|1964
00279421|Rudoltice|Ústí nad Orlicí|8|1960
00282952|Želešice|Brno - venkov|10|1959
00276596|Dolní Újezd|Svitavy|8|1957
00278335|Svoboda nad Úpou|Trutnov|7|1951
00266256|Bystřany|Teplice|5|1948
00235636|Plaňany|Kolín|1|1947
00245895|Horní Planá|Český Krumlov|2|1943
00262455|Lučany nad Nisou|Jablonec nad Nisou|6|1941
00290793|Bílovice|Uherské Hradiště|12|1935
00233269|Hostomice|Beroun|1|1935
00303747|Dolní Bečva|Vsetín|12|1929
00257753|Heřmanova Huť|Plzeň - sever|3|1929
00292231|Pustiměř|Vyškov|10|1928
00257851|Chrást|Plzeň - město|3|1925
00281042|Svitávka|Blansko|10|1925
00235300|Cerhenice|Kolín|1|1924
00261131|Žandov|Česká Lípa|6|1922
00297976|Jeseník nad Odrou|Nový Jičín|13|1920
00288497|Němčice nad Hanou|Prostějov|11|1918
00535958|Hrádek|Frýdek - Místek|13|1917
00240401|Kunice|Praha - východ|1|1916
00577031|Řepiště|Frýdek - Místek|13|1915
00239283|Kostomlaty nad Labem|Nymburk|1|1914
00252352|Chotoviny|Tábor|2|1912
00849961|Kozmice|Opava|13|1911
00285111|Milotice|Hodonín|10|1910
00266833|Libouchec|Ústí nad Labem|5|1907
00303453|Štíty|Šumperk|11|1905
00235962|Žiželice|Kolín|1|1904
00298913|Hněvotín|Olomouc|11|1903
00284769|Blatnice pod Svatým Antonínkem|Hodonín|10|1900
00233358|Chyňava|Beroun|1|1898
00282090|Měnín|Brno - venkov|10|1897
00252522|Malšice|Tábor|2|1893
00254231|Skalná|Cheb|4|1892
00241156|Davle|Praha - západ|1|1891
00264521|Třebenice|Litoměřice|5|1889
00264083|Mšené-lázně|Litoměřice|5|1886
00254169|Plesná|Cheb|4|1886
00299588|Tršice|Olomouc|11|1885
00535982|Písek|Frýdek - Místek|13|1884
00285749|Dobronín|Jihlava|9|1883
00240567|Ondřejov|Praha - východ|1|1883
00254444|Bochov|Karlovy Vary|4|1874
00273988|Moravany|Pardubice|8|1873
00283274|Kostice|Břeclav|10|1872
00248185|Horní Cerekev|Pelhřimov|9|1871
00271748|Libáň|Jičín|7|1868
00288560|Olšany u Prostějova|Prostějov|11|1867
00488275|Popůvky|Brno - venkov|10|1866
44026927|Nový Šaldorf - Sedlešovice|Znojmo|10|1864
00290777|Babice|Uherské Hradiště|12|1862
75158094|Želechovice nad Dřevnicí|Zlín|12|1859
00301019|Bělotín|Přerov|11|1854
00275735|Horní Branná|Semily|6|1854
00265705|Vroutek|Louny|5|1854
00258491|Vochov|Plzeň - sever|3|1853
00270881|Seč|Chrudim|8|1848
00259021|Radnice|Rokycany|3|1847
00038130|Sloupnice|Svitavy|8|1845
00301078|Brodek u Přerova|Přerov|11|1844
00299570|Troubelice|Olomouc|11|1843
00542423|Holubice|Vyškov|10|1839
00298352|Sedlnice|Nový Jičín|13|1834
00231690|Divišov|Benešov|1|1831
00304263|Ratiboř|Vsetín|12|1829
00300845|Velké Hoštice|Opava|13|1829
00294616|Křižanov|Žďár nad Sázavou|9|1827
00283142|Drnholec|Břeclav|10|1826
00276162|Studenec|Semily|6|1826
00283070|Březí|Břeclav|10|1822
00269786|Vysoká nad Labem|Hradec Králové|7|1822
00290980|Jalubí|Uherské Hradiště|12|1821
00304042|Lidečko|Vsetín|12|1821
00246816|Chlum u Třeboně|Jindřichův Hradec|2|1816
00600733|Kunín|Nový Jičín|13|1816
00298841|Drahanovice|Olomouc|11|1810
00038113|Libchavy|Ústí nad Orlicí|8|1810
00304221|Prostřední Bečva|Vsetín|12|1810
00263001|Mníšek|Liberec|6|1799
00284173|Lukov|Zlín|12|1793
00235083|Velká Dobrá|Kladno|1|1793
00535991|Metylovice|Frýdek - Místek|13|1790
00278041|Lánov|Trutnov|7|1789
00274909|Doudleby nad Orlicí|Rychnov nad Kněžnou|7|1787
00299839|Bohuslavice|Opava|13|1786
00289426|Hrotovice|Třebíč|9|1784
00269760|Všestary|Hradec Králové|7|1782
00247022|Lomnice nad Lužnicí|Jindřichův Hradec|2|1778
00236918|Kly|Mělník|1|1770
00248037|Černovice|Pelhřimov|9|1769
01265741|Poličná|Vsetín|12|1769
00263648|Hoštka|Litoměřice|5|1768
00274283|Srch|Pardubice|8|1768
00298018|Jistebník|Nový Jičín|13|1766
00304433|Vidče|Vsetín|12|1765
00292788|Hodonice|Znojmo|10|1758
00299421|Senice na Hané|Olomouc|11|1757
72086718|Libhošť|Nový Jičín|13|1756
00253235|Bělá nad Radbuzou|Domažlice|3|1754
00275913|Mírová pod Kozákovem|Semily|6|1752
70305587|Ropice|Frýdek - Místek|13|1752
00301329|Hustopeče nad Bečvou|Přerov|11|1751
00282294|Ostopovice|Brno - venkov|10|1751
00250821|Vlachovo Březí|Prachatice|2|1750
00298263|Petřvald|Nový Jičín|13|1748
00297658|Stonava|Karviná|13|1748
00244856|Dubné|České Budějovice|2|1747
00241849|Všenory|Praha - západ|1|1746
00239305|Kounice|Nymburk|1|1738
00234273|Doksy|Kladno|1|1736
00288934|Vrbátky|Prostějov|11|1729
00297721|Bartošovice|Nový Jičín|13|1725
00241750|Tuchoměřice|Praha - západ|1|1724
00297178|Sedliště|Frýdek - Místek|13|1723
00250872|Zdíkov|Prachatice|2|1721
00237141|Obříství|Mělník|1|1718
00293571|Šanov|Znojmo|10|1716
00258512|Všeruby|Plzeň - sever|3|1716
00290840|Březolupy|Uherské Hradiště|12|1715
00283126|Dolní Dunajovice|Břeclav|10|1715
00244791|Dolní Bukovsko|České Budějovice|2|1712
00244830|Dříteň|České Budějovice|2|1711
00575666|Medlov|Olomouc|11|1711
00302333|Bělá pod Pradědem|Jeseník|11|1710
00288390|Kralice na Hané|Prostějov|11|1708
00239712|Rožďalovice|Nymburk|1|1703
00241393|Lety|Praha - západ|1|1701
00235741|Starý Kolín|Kolín|1|1696
00264601|Velemín|Litoměřice|5|1695
00270580|Nasavrky|Chrudim|8|1693
00297917|Hodslavice|Nový Jičín|13|1692
00290491|Stařeč|Třebíč|9|1691
00274780|Častolovice|Rychnov nad Kněžnou|7|1686
00244902|Homole|České Budějovice|2|1685
00250945|Bavorov|Strakonice|2|1683
00259888|Kladruby|Tachov|3|1682
00635545|Vřesina|Opava|13|1679
00292834|Hostěradice|Znojmo|10|1678
00303364|Staré Město|Šumperk|11|1678
75082144|Držovice|Prostějov|11|1676
00301264|Horní Moštěnice|Přerov|11|1676
00260479|Dubá|Česká Lípa|6|1672
00282677|Telnice|Brno - venkov|10|1670
00273431|Býšť|Pardubice|8|1669
00579530|Hradec nad Svitavou|Svitavy|8|1669
00261289|Dolní Poustevna|Děčín|5|1668
00270822|Ronov nad Doubravou|Chrudim|8|1668
00299537|Šumvald|Olomouc|11|1666
00256153|Švihov|Klatovy|3|1666
00282936|Žabčice|Brno - venkov|10|1664
00275026|Kvasiny|Rychnov nad Kněžnou|7|1658
00275841|Košťálov|Semily|6|1657
00234265|Červený Újezd|Praha - západ|1|1654
00283185|Hrušky|Břeclav|10|1654
00288772|Smržice|Prostějov|11|1654
00259535|Oloví|Sokolov|4|1651
00232513|Poříčí nad Sázavou|Benešov|1|1651
00243329|Stará Huť|Příbram|1|1650
00240486|Mochov|Praha - východ|1|1648
00600032|Mostkovice|Prostějov|11|1646
00264725|Žitenice|Litoměřice|5|1643
00284491|Spytihněv|Zlín|12|1642
00291153|Nedakonice|Uherské Hradiště|12|1636
00298867|Dub nad Moravou|Olomouc|11|1632
00243825|Jesenice|Rakovník|1|1632
00241415|Libeř|Praha - západ|1|1630
00255980|Plánice|Klatovy|3|1629
00233200|Drahelčice|Praha - západ|1|1626
00291609|Zlechov|Uherské Hradiště|12|1624
00249858|Mirovice|Písek|2|1623
00260118|Přimda|Tachov|3|1621
00280755|Olešnice|Blansko|10|1620
00673455|Skalice u České Lípy|Česká Lípa|6|1620
00300837|Velké Heraltice|Opava|13|1620
00234397|Hostouň|Kladno|1|1619
00573141|Svatava|Sokolov|4|1619
00296899|Lučina|Frýdek - Místek|13|1618
00234508|Kamenné Žehrovice|Kladno|1|1616
00273139|Teplice nad Metují|Náchod|7|1614
00292567|Božice|Znojmo|10|1613
00488895|Chvalčov|Kroměříž|12|1610
00291404|Šumice|Uherské Hradiště|12|1610
00275778|Jablonec nad Jizerou|Semily|6|1609
00258911|Mýto|Rokycany|3|1602
00256358|Železná Ruda|Klatovy|3|1599
00253243|Blížejov|Domažlice|3|1598
00241351|Kamenný Přívoz|Praha - západ|1|1598
00278114|Malé Svatoňovice|Trutnov|7|1596
00298115|Lichnov|Nový Jičín|13|1595
00543870|Hamry nad Sázavou|Žďár nad Sázavou|9|1587
00244678|Borek|České Budějovice|2|1585
00292206|Otnice|Vyškov|10|1585
00241679|Statenice|Praha - západ|1|1585
00269549|Smidary|Hradec Králové|7|1583
00291421|Topolná|Uherské Hradiště|12|1582
00300730|Šilheřovice|Opava|13|1580
00488291|Rajhradice|Brno - venkov|10|1579
00299456|Slatinice|Olomouc|11|1578
00283614|Šakvice|Břeclav|10|1574
00236799|Dolní Beřkovice|Mělník|1|1573
00240231|Husinec|Praha - východ|1|1573
00239666|Poříčany|Kolín|1|1572
00241491|Ohrobec|Praha - západ|1|1571
00483869|Březová nad Svitavou|Svitavy|8|1569
00267716|Krucemburk|Havlíčkův Brod|9|1569
00283746|Zaječí|Břeclav|10|1567
00276529|Bystré|Svitavy|8|1563
00242861|Nová Ves pod Pleší|Příbram|1|1562
00282243|Ochoz u Brna|Brno - venkov|10|1560
00304051|Liptál|Vsetín|12|1558
00250384|Čkyně|Prachatice|2|1553
00235750|Stříbrná Skalice|Praha - východ|1|1553
00253669|Poběžovice|Domažlice|3|1551
00298875|Grygov|Olomouc|11|1548
00240532|Nová Ves|Praha - východ|1|1548
00284718|Zádveřice-Raková|Zlín|12|1546
00284840|Dambořice|Hodonín|10|1545
00299871|Brumovice|Opava|13|1542
00671886|Šimonovice|Liberec|6|1542
00262137|Spořice|Chomutov|5|1537
00535133|Dolní Lhota|Ostrava - město|13|1535
00240249|Jenštejn|Praha - východ|1|1535
00301914|Rokytnice|Přerov|11|1532
00262358|Janov nad Nisou|Jablonec nad Nisou|6|1531
00298719|Bouzov|Olomouc|11|1526
00263893|Liběšice|Litoměřice|5|1524
00253952|Hazlov|Cheb|4|1522
00280569|Lipůvka|Blansko|10|1522
00237035|Lužec nad Vltavou|Mělník|1|1520
00576948|Staré Město|Frýdek - Místek|13|1517
00241741|Třebotov|Praha - západ|1|1516
00494232|Komorní Lhotka|Frýdek - Místek|13|1515
00245372|Roudné|České Budějovice|2|1514
00238945|Žďár|Mladá Boleslav|1|1514
00263486|Čížkovice|Litoměřice|5|1511
00257958|Kožlany|Plzeň - sever|3|1511
00299618|Újezd|Olomouc|11|1509
00240460|Mirošovice|Praha - východ|1|1507
00244961|Hrdějovice|České Budějovice|2|1506
00232874|Trhový Štěpánov|Benešov|1|1506
00234044|Zaječov|Beroun|1|1502
00240893|Lázně Toušeň|Praha - východ|1|1501
00300543|Otice|Opava|13|1500
00278432|Vítězná|Trutnov|7|1499
00283371|Moravský Žižkov|Břeclav|10|1497
00299251|Náklo|Olomouc|11|1497
00296678|Hnojník|Frýdek - Místek|13|1493
00244929|Horní Stropnice|České Budějovice|2|1492
00288501|Nezamyslice|Prostějov|11|1490
00290751|Želetava|Třebíč|9|1488
00244368|Řevničov|Rakovník|1|1487
00239747|Semice|Nymburk|1|1487
00274194|Rybitví|Pardubice|8|1486
48471828|Březnice|Zlín|12|1485
00263851|Křešice|Litoměřice|5|1484
00280577|Lomnice|Brno - venkov|10|1483
00304361|Valašská Polanka|Vsetín|12|1482
00291196|Ostrožská Lhota|Uherské Hradiště|12|1481
00259276|Bukovany|Sokolov|4|1479
00245984|Loučovice|Český Krumlov|2|1479
00288063|Brodek u Prostějova|Prostějov|11|1477
00568741|Tečovice|Zlín|12|1475
00249777|Kovářov|Písek|2|1474
00494241|Dolní Domaslavice|Frýdek - Místek|13|1472
00235881|Veltruby|Kolín|1|1471
00365416|Předklášteří|Brno - venkov|10|1469
00300527|Oldřišov|Opava|13|1468
00250783|Vacov|Prachatice|2|1467
00240028|Babice|Praha - východ|1|1466
00303755|Francova Lhota|Vsetín|12|1465
00257028|Nezvěstice|Plzeň - město|3|1464
00232521|Postupice|Benešov|1|1464
00281557|Babice nad Svitavou|Brno - venkov|10|1462
00245992|Malonty|Český Krumlov|2|1461
00301213|Dřevohostice|Přerov|11|1460
00284670|Vlachovice|Zlín|12|1460
00240826|Světice|Praha - východ|1|1458
44684983|Březová-Oleško|Praha - západ|1|1457
00576255|Přáslavice|Olomouc|11|1451
00292761|Hevlín|Znojmo|10|1449
00236756|Byšice|Mělník|1|1448
00258717|Holoubkov|Rokycany|3|1448
00266981|Řehlovice|Ústí nad Labem|5|1446
00635740|Červenka|Olomouc|11|1445
00237914|Chotětov|Mladá Boleslav|1|1444
00261823|Březno|Chomutov|5|1443
00270733|Prachovice|Chrudim|8|1442
00256731|Kasejovice|Plzeň - jih|3|1441
00255688|Kolinec|Klatovy|3|1438
00246964|Kunžak|Jindřichův Hradec|2|1438
00300691|Stěbořice|Opava|13|1438
00302953|Loučná nad Desnou|Šumperk|11|1435
00252638|Opařany|Tábor|2|1433
00258954|Osek|Rokycany|3|1433
00640221|Zbuzany|Praha - západ|1|1433
00253472|Klenčí pod Čerchovem|Domažlice|3|1432
00231550|Čechtice|Benešov|1|1430
00236691|Žleby|Kutná Hora|1|1429
00287920|Zborovice|Kroměříž|12|1428
00299880|Březová|Opava|13|1426
00235369|Doubravčice|Kolín|1|1426
00240630|Předboj|Praha - východ|1|1424
00508888|Bradlec|Mladá Boleslav|1|1422
00635936|Dolní Studénky|Šumperk|11|1421
00256871|Losiná|Plzeň - město|3|1421
00637611|Tasovice|Znojmo|10|1420
00280844|Ráječko|Blansko|10|1419
67024645|Suchohrdly|Znojmo|10|1419
00282332|Podolí|Brno - venkov|10|1418
00237078|Mšeno|Mělník|1|1415
00299677|Velký Újezd|Olomouc|11|1415
00236641|Zbraslavice|Kutná Hora|1|1415
00241873|Zlatníky - Hodkovice|Praha - západ|1|1415
00274208|Řečany nad Labem|Pardubice|8|1414
00285056|Lipov|Hodonín|10|1412
00239399|Loučeň|Nymburk|1|1412
67339158|Chotěbuz|Karviná|13|1411
00831786|Dobroměřice|Louny|5|1407
00289591|Kněžice|Jihlava|9|1407
00249530|Bernartice|Písek|2|1405
00250449|Husinec|Prachatice|2|1405
00272426|Železnice|Jičín|7|1405
00240494|Mratín|Praha - východ|1|1404
00295884|Brantice|Bruntál|13|1403
00254029|Lázně Kynžvart|Cheb|4|1403
00247511|Strmilov|Jindřichův Hradec|2|1403
00488143|Holasice|Brno - venkov|10|1402
00265098|Lenešice|Louny|5|1402
00276987|Městečko Trnávka|Svitavy|8|1402
00241644|Řitka|Praha - západ|1|1401
00276880|Kunčina|Svitavy|8|1400
00635707|Věrovany|Olomouc|11|1399
00232416|Olbramovice|Benešov|1|1397
00288870|Určice|Prostějov|11|1397
00270334|Krouna|Chrudim|8|1395
00577057|Dobratice|Frýdek - Místek|13|1393
00265811|Bečov|Most|5|1389
00245844|Dolní Dvořiště|Český Krumlov|2|1388
00275697|Harrachov|Jablonec nad Nisou|6|1388
00291986|Letonice|Vyškov|10|1388
00283037|Bořetice|Břeclav|10|1386
00289922|Mohelno|Třebíč|9|1386
00231860|Chocerady|Benešov|1|1383
00303046|Moravičany|Šumperk|11|1379
00283428|Nosislav|Brno - venkov|10|1379
00240737|Senohraby|Praha - východ|1|1379
00280151|Drnovice|Blansko|10|1377
00241067|Zlonín|Praha - východ|1|1377
00245780|Benešov nad Černou|Český Krumlov|2|1376
00260169|Stráž|Tachov|3|1376
00535940|Bukovec|Frýdek - Místek|13|1375
00300080|Holasovice|Opava|13|1374
00235580|Nová Ves I|Kolín|1|1374
00242471|Kosova Hora|Příbram|1|1373
00259497|Lomnice|Sokolov|4|1372
00488372|Viničné Šumice|Brno - venkov|10|1372
00283444|Novosedly|Břeclav|10|1371
00276073|Rovensko pod Troskami|Semily|6|1371
00260142|Staré Sedliště|Tachov|3|1370
00282731|Tvarožná|Brno - venkov|10|1370
00239364|Křinec|Nymburk|1|1369
00270831|Rosice|Chrudim|8|1368
00255645|Kašperské Hory|Klatovy|3|1367
00245500|Ševětín|České Budějovice|2|1367
00295531|Svratka|Žďár nad Sázavou|9|1367
00277673|Bílá Třemešná|Trutnov|7|1366
00249602|Čížová|Písek|2|1366
00233528|Lochovice|Beroun|1|1366
00251721|Radomyšl|Strakonice|2|1366
00568708|Pozlovice|Zlín|12|1364
00263265|Višňová|Liberec|6|1364
00635456|Darkovice|Opava|13|1363
00267953|Okrouhlice|Havlíčkův Brod|9|1363
00256102|Strážov|Klatovy|3|1362
00296392|Světlá Hora|Bruntál|13|1362
00284246|Nedašov|Zlín|12|1358
00301680|Osek nad Bečvou|Přerov|11|1358
00239852|Třebestovice|Nymburk|1|1358
00258679|Dobřív|Rokycany|3|1357
00294926|Nové Veselí|Žďár nad Sázavou|9|1356
00250091|Sepekov|Písek|2|1356
00245861|Frymburk|Český Krumlov|2|1355
00266302|Háj u Duchcova|Teplice|5|1353
00278734|Dolní Čermná|Ústí nad Orlicí|8|1352
00292249|Račice - Pístovice|Vyškov|10|1351
00299545|Těšetice|Olomouc|11|1350
00245852|Dolní Třebonín|Český Krumlov|2|1348
00263346|Bechlín|Litoměřice|5|1347
00255530|Hrádek|Klatovy|3|1347
00263125|Příšovice|Liberec|6|1345
00245453|Staré Hodějovice|České Budějovice|2|1345
00273961|Mikulovice|Pardubice|8|1344
00240834|Svojetice|Praha - východ|1|1341
00300608|Pustá Polom|Opava|13|1340
00240141|Dobřejovice|Praha - východ|1|1339
00534927|Doloplazy|Olomouc|11|1338
00257800|Hromnice|Plzeň - sever|3|1338
00283151|Hlohovec|Břeclav|10|1336
00556271|Černčice|Louny|5|1335
00283291|Křepice|Břeclav|10|1334
00261378|Chřibská|Děčín|5|1333
00280143|Doubravice nad Svitavou|Blansko|10|1333
00294306|Herálec|Žďár nad Sázavou|9|1331
00251305|Katovice|Strakonice|2|1331
00288144|Čelechovice na Hané|Prostějov|11|1329
00263397|Brozany nad Ohří|Litoměřice|5|1326
00492621|Milíkov|Frýdek - Místek|13|1325
00271900|Ostroměř|Jičín|7|1324
00243027|Petrovice|Příbram|1|1324
48769967|Samotišky|Olomouc|11|1323
00294241|Dolní Loučky|Brno - venkov|10|1320
00264202|Polepy|Litoměřice|5|1319
00250708|Strunkovice nad Blanicí|Prachatice|2|1317
00228711|Příkazy|Olomouc|11|1316
00241300|Jeneč|Praha - západ|1|1315
00296945|Morávka|Frýdek - Místek|13|1315
00285218|Petrov|Hodonín|10|1315
00286834|Velký Beranov|Jihlava|9|1315
00303780|Horní Lideč|Vsetín|12|1314
00270504|Miřetice|Chrudim|8|1313
00236012|Církvice|Kutná Hora|1|1312
00271926|Pecka|Jičín|7|1311
00580902|Dlouhá Třebová|Ústí nad Orlicí|8|1310
00277185|Pomezí|Svitavy|8|1310
00267422|Habry|Havlíčkův Brod|9|1309
00303101|Oskava|Šumperk|11|1305
00283991|Hvozdná|Zlín|12|1304
00254959|Sadov|Karlovy Vary|4|1304
00262153|Údlice|Chomutov|5|1304
00293831|Vrbovec|Znojmo|10|1304
00260401|Brniště|Česká Lípa|6|1303
00279960|Bořitov|Blansko|10|1302
00288586|Otaslavice|Prostějov|11|1302
00265217|Lubenec|Louny|5|1301
00278564|Brandýs nad Orlicí|Ústí nad Orlicí|8|1300
00282693|Těšany|Brno - venkov|10|1299
00236764|Cítov|Mělník|1|1296
00262366|Jenišovice|Jablonec nad Nisou|6|1296
00241695|Středokluky|Praha - západ|1|1292
00293725|Únanov|Znojmo|10|1292
00257834|Chotíkov|Plzeň - sever|3|1290
00282910|Zbraslav|Brno - venkov|10|1285
00258580|Žihle|Plzeň - sever|3|1283
00573132|Dolní Rychnov|Sokolov|4|1282
00300764|Štítina|Opava|13|1282
00272311|Valdice|Jičín|7|1281
00244384|Senomaty|Rakovník|1|1280
00235059|Úhonice|Praha - západ|1|1280
00283282|Krumvíř|Břeclav|10|1279
00276294|Vysoké nad Jizerou|Semily|6|1278
00240435|Louňovice|Praha - východ|1|1277
00294845|Nedvědice|Brno - venkov|10|1277
00299316|Paseka|Olomouc|11|1277
00300161|Chuchelná|Opava|13|1276
00251755|Sedlice|Strakonice|2|1276
00233901|Tmaň|Beroun|1|1265
00270202|Chroustovice|Chrudim|8|1264
75082128|Ladná|Břeclav|10|1261
00233501|Liteň|Beroun|1|1261
00242918|Obecnice|Příbram|1|1261
00600741|Rybí|Nový Jičín|13|1261
00259217|Volduchy|Rokycany|3|1260
00302376|Bohdíkov|Šumperk|11|1258
00488160|Kobylnice|Brno - venkov|10|1258
00285331|Sudoměřice|Hodonín|10|1257
00233994|Vráž|Beroun|1|1257
00291650|Bošovice|Vyškov|10|1255
00636223|Dolní Újezd|Přerov|11|1255
00233285|Hudlice|Beroun|1|1255
00262463|Malá Skála|Jablonec nad Nisou|6|1255
00284815|Čejč|Hodonín|10|1252
00281603|Blažovice|Brno - venkov|10|1248
00239682|Přerov nad Labem|Nymburk|1|1246
00302881|Leština|Šumperk|11|1244
00273643|Choltice|Pardubice|8|1243
00278394|Velké Svatoňovice|Trutnov|7|1243
00233234|Hlásná Třebaň|Beroun|1|1242
00295973|Dvorce|Bruntál|13|1241
00292915|Jaroslavice|Znojmo|10|1237
00253553|Meclov|Domažlice|3|1237
72054433|Petrov nad Desnou|Šumperk|11|1237
00301795|Potštát|Přerov|11|1237
00259641|Vintířov|Sokolov|4|1235
00245925|Chvalšiny|Český Krumlov|2|1233
00285765|Dolní Cerekev|Jihlava|9|1233
00249840|Mirotice|Písek|2|1232
00257133|Příchovice|Plzeň - jih|3|1231
00261653|Staré Křečany|Děčín|5|1228
00234494|Kačice|Kladno|1|1226
00277258|Radiměř|Svitavy|8|1225
00292419|Velešovice|Vyškov|10|1225
00236829|Horní Počaply|Mělník|1|1220
00279200|Lukavice|Ústí nad Orlicí|8|1220
00278190|Pilníkov|Trutnov|7|1218
00288683|Přemyslovice|Prostějov|11|1218
00276464|Brněnec|Svitavy|8|1217
00295655|Velká Losenice|Žďár nad Sázavou|9|1217
00292516|Blížkovice|Znojmo|10|1215
00239381|Libice nad Cidlinou|Nymburk|1|1215
00253391|Hostouň|Domažlice|3|1213
00290378|Rouchovany|Třebíč|9|1210
00266311|Hostomice|Teplice|5|1208
00235661|Radim|Kolín|1|1206
00237264|Velký Borek|Mělník|1|1200
00265845|Braňany|Most|5|1199
00294004|Bohdalov|Žďár nad Sázavou|9|1197
00289159|Budišov|Třebíč|9|1197
00259772|Černošín|Tachov|3|1196
00280551|Lipovec|Blansko|10|1195
00272957|Provodov-Šonov|Náchod|7|1193
00291439|Traplice|Uherské Hradiště|12|1193
00273449|Čeperka|Pardubice|8|1192
00232360|Netvořice|Benešov|1|1191
00303585|Vidnava|Jeseník|11|1190
00488381|Vojkovice|Brno - venkov|10|1190
00245666|Všemyslice|České Budějovice|2|1190
00533947|Chlebičov|Opava|13|1188
00299197|Majetín|Olomouc|11|1188
00256901|Merklín|Plzeň - jih|3|1188
00278157|Mostek|Trutnov|7|1188
00263061|Osečná|Liberec|6|1184
00284602|Újezd|Zlín|12|1184
00235890|Vitice|Kolín|1|1184
00241148|Čisovice|Praha - západ|1|1182
00276758|Jaroměřice|Svitavy|8|1182
00303411|Sudkov|Šumperk|11|1182
00287644|Prusinovice|Kroměříž|12|1181
00303526|Vápenná|Jeseník|11|1181
00241288|Chrášťany|Praha - západ|1|1180
00291129|Mistřice|Uherské Hradiště|12|1180
00267805|Lípa|Havlíčkův Brod|9|1179
00262145|Strupčice|Chomutov|5|1178
00284581|Trnava|Zlín|12|1178
00248720|Nová Cerekev|Pelhřimov|9|1177
00600679|Velké Albrechtice|Nový Jičín|13|1177
00294471|Jimramov|Žďár nad Sázavou|9|1176
00291374|Suchá Loz|Uherské Hradiště|12|1176
00233196|Cerhovice|Beroun|1|1175
00242691|Malá Hraštice|Příbram|1|1175
00253910|Dolní Žandov|Cheb|4|1174
00300624|Raduň|Opava|13|1174
00262242|Vysoká Pec|Chomutov|5|1173
00488241|Opatovice|Brno - venkov|10|1172
00284734|Žlutava|Zlín|12|1172
00266809|Chuderov|Ústí nad Labem|5|1171
00261742|Verneřice|Děčín|5|1171
00290661|Vladislav|Třebíč|9|1171
00262111|Radonice|Chomutov|5|1169
00240877|Tehov|Praha - východ|1|1169
00249483|Želiv|Pelhřimov|9|1169
00640140|Herink|Praha - východ|1|1167
00300462|Mokré Lazce|Opava|13|1167
00273082|Studnice|Náchod|7|1167
00298662|Bílá Lhota|Olomouc|11|1166
00303500|Úsov|Šumperk|11|1164
00293270|Olbramovice|Znojmo|10|1163
00600831|Ženklava|Nový Jičín|13|1163
00600709|Závišice|Nový Jičín|13|1161
00292923|Jevišovice|Znojmo|10|1159
00255823|Mochtín|Klatovy|3|1159
00282154|Moutnice|Brno - venkov|10|1158
00262072|Perštejn|Chomutov|5|1155
00288004|Bedihošť|Prostějov|11|1153
00261271|Dolní Podluží|Děčín|5|1153
00266493|Modlany|Teplice|5|1153
00488216|Moravské Knínice|Brno - venkov|10|1153
00269514|Skřivany|Hradec Králové|7|1153
00267457|Herálec|Havlíčkův Brod|9|1152
00255866|Nalžovské Hory|Klatovy|3|1152
00249629|Dobev|Písek|2|1150
00253618|Mrákov|Domažlice|3|1150
00269352|Praskačka|Hradec Králové|7|1149
00240681|Radonice|Praha - východ|1|1148
00544507|Všemina|Zlín|12|1147
00296473|Zátor|Bruntál|13|1147
00562424|Doubrava|Karviná|13|1146
00284912|Hroznová Lhota|Hodonín|10|1146
00234915|Stehelčeves|Kladno|1|1146
00266647|Zabrušany|Teplice|5|1146
00237361|Záryby|Praha - východ|1|1146
00236233|Miskovice|Kutná Hora|1|1145
00280020|Březina|Brno - venkov|10|1144
00237256|Úžice|Mělník|1|1144
00267279|Česká Bělá|Havlíčkův Brod|9|1143
00242535|Krásná Hora nad Vltavou|Příbram|1|1143
00287679|Rataje|Kroměříž|12|1142
00635693|Skrbeň|Olomouc|11|1142
00303348|Sobotín|Šumperk|11|1141
00237043|Malý Újezd|Mělník|1|1138
00258091|Manětín|Plzeň - sever|3|1136
00278343|Špindlerův Mlýn|Trutnov|7|1136
00232025|Krhanice|Benešov|1|1135
00273392|Břehy|Pardubice|8|1133
00293580|Šatov|Znojmo|10|1133
00281697|Deblín|Brno - venkov|10|1132
00278599|Bystřec|Ústí nad Orlicí|8|1130
00291536|Velehrad|Uherské Hradiště|12|1130
00275581|Benecko|Semily|6|1129
00288128|Čechy pod Kosířem|Prostějov|11|1129
00277088|Opatov|Svitavy|8|1128
00301884|Radslavice|Přerov|11|1128
00303682|Žulová|Jeseník|11|1128
00234176|Braškov|Kladno|1|1126
00274020|Ostřešany|Pardubice|8|1126
00662941|Podlesí|Příbram|1|1126
00275387|Skuhrov nad Bělou|Rychnov nad Kněžnou|7|1126
00239771|Sokoleč|Nymburk|1|1126
00573248|Jenišov|Karlovy Vary|4|1124
44947917|Tetčice|Brno - venkov|10|1124
00255785|Měčín|Klatovy|3|1122
00302538|Dubicko|Šumperk|11|1121
00258024|Kyšice|Plzeň - město|3|1121
00292141|Nesovice|Vyškov|10|1121
00363171|Kanice|Brno - venkov|10|1120
00244023|Lubná|Rakovník|1|1120
00275956|Ohrazenice|Semily|6|1120
00283657|Uherčice|Břeclav|10|1120
00509230|Písková Lhota|Mladá Boleslav|1|1119
00236462|Suchdol|Kutná Hora|1|1119
00274933|Javornice|Rychnov nad Kněžnou|7|1118
00296074|Jindřichov|Bruntál|13|1118
00232289|Načeradec|Benešov|1|1118
00556432|Staňkovice|Louny|5|1118
00285528|Žarošice|Hodonín|10|1117
00235431|Klučov|Kolín|1|1116
00237540|Brodce|Mladá Boleslav|1|1114
00250678|Stachy|Prachatice|2|1114
00235091|Velké Přítočno|Kladno|1|1112
00245038|Jílovice|České Budějovice|2|1111
00266345|Hrobčice|Teplice|5|1110
00542393|Tupesy|Uherské Hradiště|12|1110
00236811|Dřísy|Praha - východ|1|1108
00264431|Straškov-Vodochody|Litoměřice|5|1108
00276006|Poniklá|Semily|6|1106
00244341|Rynholec|Rakovník|1|1103
00488313|Sivice|Brno - venkov|10|1101
00576921|Třanovice|Frýdek - Místek|13|1101
00283649|Týnec|Břeclav|10|1099
00300136|Hrabyně|Opava|13|1098
00600211|Přibice|Brno - venkov|10|1098
00268682|Černožice|Hradec Králové|7|1097
00288691|Ptení|Prostějov|11|1097
00276081|Roztoky u Jilemnice|Semily|6|1095
00672106|Bílý Kostel nad Nisou|Liberec|6|1094
00235822|Tuklaty|Kolín|1|1094
00233897|Tlustice|Beroun|1|1093
00280780|Ostrov u Macochy|Blansko|10|1092
00488089|Rebešovice|Brno - venkov|10|1092
00256561|Dolní Lukavice|Plzeň - jih|3|1091
00302741|Jindřichov|Šumperk|11|1091
00288675|Protivanov|Prostějov|11|1090
00635677|Hlušovice|Olomouc|11|1089
00245879|Holubov|Český Krumlov|2|1089
00304441|Vigantice|Vsetín|12|1088
00246859|Jarošov nad Nežárkou|Jindřichův Hradec|2|1087
00301388|Kokory|Přerov|11|1087
00253685|Postřekov|Domažlice|3|1087
00274798|Čermná nad Orlicí|Rychnov nad Kněžnou|7|1085
00286656|Stonařov|Jihlava|9|1085
00259829|Halže|Tachov|3|1084
00509663|Chrustenice|Beroun|1|1083
00303917|Kateřinice|Vsetín|12|1083
00277827|Hajnice|Trutnov|7|1082
00276782|Jedlová|Svitavy|8|1082
00494216|Pržno|Frýdek - Místek|13|1081
00237574|Březno|Mladá Boleslav|1|1080
00257940|Kozolupy|Plzeň - sever|3|1078
00237019|Liběchov|Mělník|1|1078
00280763|Olomučany|Blansko|10|1078
00282499|Rozdrojovice|Brno - venkov|10|1078
00240745|Sibřina|Praha - východ|1|1078
47812303|Branka u Opavy|Opava|13|1077
00672033|Chotyně|Liberec|6|1077
00556262|Cítoliby|Louny|5|1077
00233005|Vrchotovy Janovice|Benešov|1|1077
00253499|Kout na Šumavě|Domažlice|3|1076
00576913|Střítež|Frýdek - Místek|13|1076
00293784|Višňové|Znojmo|10|1076
00283738|Vrbice|Břeclav|10|1076
00257338|Tymákov|Plzeň - město|3|1075
00234320|Družec|Kladno|1|1074
00291773|Hodějice|Vyškov|10|1074
00536008|Horní Domaslavice|Frýdek - Místek|13|1074
00244210|Pavlíkov|Rakovník|1|1073
70632430|Písečná|Frýdek - Místek|13|1073
00273601|Horní Ředice|Pardubice|8|1071
00254304|Tři Sekery|Cheb|4|1071
00235245|Bečváry|Kolín|1|1070
00273511|Dolní Ředice|Pardubice|8|1070
00242195|Dublovice|Příbram|1|1070
00245801|Brloh|Český Krumlov|2|1069
00292346|Šaratice|Vyškov|10|1069
00273147|Kramolna|Náchod|7|1064
00249718|Chyšky|Písek|2|1061
00296163|Lichnov|Bruntál|13|1060
00576972|Pstruží|Frýdek - Místek|13|1058
00640182|Křenice|Praha - východ|1|1057
00276545|Čistá|Svitavy|8|1055
00291013|Kněžpole|Uherské Hradiště|12|1055
00236217|Malešov|Kutná Hora|1|1054
00300187|Jakartovice|Opava|13|1052
00277100|Osík|Svitavy|8|1052
00272809|Machov|Náchod|7|1049
00276014|Přepeře|Semily|6|1049
00253880|Zahořany|Domažlice|3|1048
00264784|Blšany|Louny|5|1046
00276430|Borová|Svitavy|8|1045
00635570|Dolní Životice|Opava|13|1045
00573272|Otovice|Karlovy Vary|4|1041
00581160|Adamov|České Budějovice|2|1040
00271233|Zaječice|Chrudim|8|1040
00237299|Vojkovice|Mělník|1|1039
00848468|Hladké Životice|Nový Jičín|13|1038
00284998|Kněždub|Hodonín|10|1038
00292354|Švábenice|Vyškov|10|1037
00303739|Bystřička|Vsetín|12|1036
00277380|Staré Město|Svitavy|8|1036
00253201|Želeč|Tábor|2|1036
00277924|Chotěvice|Trutnov|7|1034
00261548|Malšovice|Děčín|5|1034
00237132|Nová Ves|Mělník|1|1034
00207381|Záhorovice|Uherské Hradiště|12|1034
00303160|Písečná|Jeseník|11|1033
00639966|Roztoky|Rakovník|1|1033
00293521|Strachotice|Znojmo|10|1032
00277738|Dolní Branná|Trutnov|7|1031
00279277|Němčice|Svitavy|8|1031
00284050|Kašava|Zlín|12|1030
00253481|Koloveč|Domažlice|3|1030
00268992|Lhota pod Libčany|Hradec Králové|7|1030
68921063|Bravantice|Nový Jičín|13|1029
00282057|Malhostovice|Brno - venkov|10|1028
00262510|Plavy|Jablonec nad Nisou|6|1028
00249521|Albrechtice nad Vltavou|Písek|2|1027
00303712|Branky|Vsetín|12|1027
00240320|Kojetice|Mělník|1|1027
00272493|OBEC BOHUSLAVICE NAD METUJÍ|Náchod|7|1027
00285471|Vlkoš|Hodonín|10|1027
00303097|Olšany|Šumperk|11|1026
00245402|Římov|České Budějovice|2|1025
00250953|Bělčice|Strakonice|2|1024
00248045|Červená Řečice|Pelhřimov|9|1024
00286133|Kostelec|Jihlava|9|1024
00262544|Rádlo|Jablonec nad Nisou|6|1023
00274658|Živanice|Pardubice|8|1023
00284866|Domanín|Hodonín|10|1022
00260975|Stružnice|Česká Lípa|6|1021
00238007|Klášter Hradiště nad Jizerou|Mladá Boleslav|1|1020
00577049|Nošovice|Frýdek - Místek|13|1020
00238473|Předměřice nad Jizerou|Mladá Boleslav|1|1020
00234524|Klobuky|Kladno|1|1018
00249599|Čimelice|Písek|2|1017
00237060|Mělnické Vtelno|Mělník|1|1016
00296279|Osoblaha|Bruntál|13|1016
00271055|Trhová Kamenice|Chrudim|8|1016
00232751|Struhařov|Benešov|1|1015
00253928|Drmoul|Cheb|4|1014
00579106|OBEC ALBRECHTICE N.O.|Rychnov nad Kněžnou|7|1014
00234842|Ptice|Praha - západ|1|1014
00300659|Skřipov|Opava|13|1013
00234257|Černuc|Kladno|1|1012
00277835|Havlovice|Trutnov|7|1012
00270938|Sobětuchy|Chrudim|8|1011
00281671|Česká|Brno - venkov|10|1010
00289698|Kralice nad Oslavou|Třebíč|9|1010
00290963|Hradčovice|Uherské Hradiště|12|1009
00240800|Struhařov|Praha - východ|1|1009
00241016|Všestary|Praha - východ|1|1009
00362956|Chudčice|Brno - venkov|10|1008
00295035|Ostrov nad Oslavou|Žďár nad Sázavou|9|1008
00283517|Popice|Břeclav|10|1008
00262404|Koberovy|Jablonec nad Nisou|6|1007
46744941|Dlouhý Most|Liberec|6|1006
00276731|Janov|Svitavy|8|1006
00635731|Pňovice|Olomouc|11|1006
00042188|Brumovice|Břeclav|10|1005
00267082|Tisá|Ústí nad Labem|5|1005
00235491|Kozojedy|Praha - východ|1|1004
00291277|Prakšice|Uherské Hradiště|12|1004
00243868|Kněževes|Rakovník|1|1003
00300071|Hněvošice|Opava|13|1002
00262013|Málkov|Chomutov|5|1002
00544531|Přílepy|Kroměříž|12|1001
00282197|Neslovice|Brno - venkov|10|999
00378640|Veverské Knínice|Brno - venkov|10|999
00296546|Bruzovice|Frýdek - Místek|13|998
00290971|Huštěnovice|Uherské Hradiště|12|998
00599247|Prace|Brno - venkov|10|998
00237302|Vraňany|Mělník|1|998
00269212|Nepolisy|Hradec Králové|7|997
00282405|Prštice|Brno - venkov|10|997
00245518|Štěpánovice|České Budějovice|2|997
00301051|Bochoř|Přerov|11|994
48770078|Bystrovany|Olomouc|11|994
00488208|Moravské Bránice|Brno - venkov|10|994
00277541|Vendolí|Svitavy|8|994
00253294|Česká Kubice|Domažlice|3|993
00600822|Pustějov|Nový Jičín|13|993
00241768|Tursko|Praha - západ|1|993
00248606|Lukavec|Pelhřimov|9|991
00600717|Bernartice nad Odrou|Nový Jičín|13|990
00233145|Broumy|Beroun|1|990
00275760|Chuchelna|Semily|6|990
00242411|Kamýk nad Vltavou|Příbram|1|990
00285552|Žeravice|Hodonín|10|990
00263621|Horní Beřkovice|Litoměřice|5|989
00279862|Žichlínek|Ústí nad Orlicí|8|989
00234192|Bratronice|Kladno|1|988
00287105|Břest|Kroměříž|12|988
00283584|Starovice|Břeclav|10|988
00235806|Tři Dvory|Kolín|1|988
00237469|Bezno|Mladá Boleslav|1|987
00265233|Měcholupy|Louny|5|987
00275271|Potštejn|Rychnov nad Kněžnou|7|987
00258393|Trnová|Plzeň - sever|3|987
00278882|Horní Čermná|Ústí nad Orlicí|8|986
00291269|Popovice|Uherské Hradiště|12|985
00373184|Luleč|Vyškov|10|983
00248738|Nový Rychnov|Pelhřimov|9|983
00236225|Svatý Mikuláš|Kutná Hora|1|983
00263192|Světlá pod Ještědem|Liberec|6|983
00296422|Úvalno|Bruntál|13|983
00362981|Jiříkovice|Brno - venkov|10|982
00266612|Světec|Teplice|5|981
00279269|Nekoř|Ústí nad Orlicí|8|980
00255424|Dolany|Klatovy|3|979
00280330|Knínice|Blansko|10|979
00287342|Kostelec u Holešova|Kroměříž|12|979
00280895|Rudice|Blansko|10|979
00280950|Sloup|Blansko|10|979
00244937|Hosín|České Budějovice|2|978
00291072|Kudlovice|Uherské Hradiště|12|978
00576867|Žabeň|Frýdek - Místek|13|978
00234028|Zadní Třebaň|Beroun|1|977
00267431|Havlíčkova Borová|Havlíčkův Brod|9|976
00235610|Oleška|Praha - východ|1|976
00298484|Tísek|Nový Jičín|13|976
00573957|Kamenný Újezd|Rokycany|3|975
00233862|Svinaře|Beroun|1|975
00268470|Vilémov|Havlíčkův Brod|9|975
00235458|Konárovice|Kolín|1|974
00277339|Sebranice|Svitavy|8|972
00291641|Bohdalice - Pavlovice|Vyškov|10|971
00240061|Bořanovice|Praha - východ|1|969
00286893|Vyskytná nad Jihlavou|Jihlava|9|969
00488224|Nové Bránice|Brno - venkov|10|967
00290858|Březová|Uherské Hradiště|12|966
00239267|Kostelní Lhota|Nymburk|1|965
00241652|Slapy|Praha - západ|1|965
00255220|Bezděkov|Klatovy|3|964
00294870|Nížkov|Žďár nad Sázavou|9|964
00576981|Soběšovice|Frýdek - Místek|13|964
00241512|Ořech|Praha - západ|1|963
00084409|Osová Bítýška|Žďár nad Sázavou|9|962
00296112|Karlovice|Bruntál|13|961
00261947|Kovářská|Chomutov|5|961
00279765|Výprachtice|Ústí nad Orlicí|8|960
00271811|Miletín|Jičín|7|958
00264598|Vědomice|Litoměřice|5|958
00262668|Bílá|Liberec|6|957
00283011|Boleradice|Břeclav|10|957
00283592|Starovičky|Břeclav|10|957
00282944|Žatčany|Brno - venkov|10|957
00267376|Dolní Město|Havlíčkův Brod|9|956
00274178|Rokytno|Pardubice|8|955
00239321|Kovanice|Nymburk|1|952
00283711|Vlasatice|Brno - venkov|10|952
00263834|Krabčice|Litoměřice|5|951
00278220|Radvanice|Trutnov|7|951
00233871|Tachlovice|Praha - západ|1|950
00291722|Dražovice|Vyškov|10|948
00284017|Jasenná|Zlín|12|948
00472051|Zápy|Praha - východ|1|947
00274330|Starý Mateřov|Pardubice|8|946
00831433|Nová Ves|Liberec|6|945
00295248|Radostín nad Oslavou|Žďár nad Sázavou|9|945
00238163|Kropáčova Vrutice|Mladá Boleslav|1|944
00276952|Lubná|Svitavy|8|943
00248355|Jiřice|Pelhřimov|9|942
00265110|Libčeves|Louny|5|940
00233595|Mořina|Beroun|1|940
00236837|Hořín|Mělník|1|939
00561193|Neplachovice|Opava|13|939
00241199|Dolany nad Vltavou|Mělník|1|938
00279099|Kunvald|Ústí nad Orlicí|8|938
00279536|Sopotnice|Ústí nad Orlicí|8|938
00251054|Čejetice|Strakonice|2|937
00262421|Kořenov|Jablonec nad Nisou|6|937
00239542|Opolany|Nymburk|1|935
00285293|Starý Poddvorov|Hodonín|10|935
00635715|Charváty|Olomouc|11|934
00235504|Krakovany|Kolín|1|934
00831964|Ludvíkovice|Děčín|5|934
00270431|Lukavice|Chrudim|8|933
00259705|Bezdružice|Tachov|3|931
00269000|Libčany|Hradec Králové|7|931
00287440|Loukov|Kroměříž|12|931
00257184|Řenče|Plzeň - jih|3|931
00256307|Vrhaveč|Klatovy|3|930
00568635|Lhota|Zlín|12|929
00291757|Habrovany|Vyškov|10|928
00292869|Hrádek|Znojmo|10|927
00240222|Hrusice|Praha - východ|1|927
00277878|Horní Maršov|Trutnov|7|925
00285064|Louka|Hodonín|10|925
00542458|Heršpice|Vyškov|10|924
00254673|Kolová|Karlovy Vary|4|924
00300381|Litultovice|Opava|13|924
00271004|Svratouch|Chrudim|8|924
00235288|Břežany II|Kolín|1|923
00279021|Klášterec nad Orlicí|Ústí nad Orlicí|8|923
00255467|Hartmanice|Klatovy|3|922
00290009|Nové Syrovice|Třebíč|9|921
00285412|Tvarožná Lhota|Hodonín|10|921
00302198|Veselíčko|Přerov|11|921
00282855|Vranov|Brno - venkov|10|920
00242101|Dolní Hbity|Příbram|1|919
00292702|Dyjákovice|Znojmo|10|919
00266264|Bžany|Teplice|5|918
00285404|Těmice|Hodonín|10|918
00237337|Vysoká|Mělník|1|917
00262692|Bulovka|Liberec|6|916
00277517|Třebařov|Svitavy|8|916
00231916|Jankov|Benešov|1|914
00262617|Zásada|Jablonec nad Nisou|6|914
00241792|Únětice|Praha - západ|1|913
00293741|Vedrovice|Znojmo|10|913
00275891|Libštát|Semily|6|912
00535966|Dolní Lomná|Frýdek - Místek|13|911
00637327|Kotvrdovice|Blansko|10|911
00259411|Krajková|Sokolov|4|911
00568686|Pohořelice|Zlín|12|911
00235181|Zvoleněves|Kladno|1|911
00653446|Holohlavy|Hradec Králové|7|910
00245909|Hořice na Šumavě|Český Krumlov|2|910
00291668|Brankovice|Vyškov|10|909
00259918|Konstantinovy Lázně|Tachov|3|909
00576051|Staré Město|Bruntál|13|909
00239089|Dymokury|Nymburk|1|908
00258032|Ledce|Plzeň - sever|3|908
00251089|Čestice|Strakonice|2|907
00231711|Dolní Kralovice|Benešov|1|907
00262391|Josefův Důl|Jablonec nad Nisou|6|907
00236276|Nové Dvory|Kutná Hora|1|907
00266922|Petrovice|Ústí nad Labem|5|907
00291234|Pitín|Uherské Hradiště|12|907
00568716|Sazovice|Zlín|12|907
00262498|Nová Ves nad Nisou|Jablonec nad Nisou|6|906
00257567|Blatnice|Plzeň - sever|3|905
00266396|Kostomlaty pod Milešovkou|Teplice|5|905
00600458|Kuchařovice|Znojmo|10|905
00232122|Lešany|Benešov|1|905
00251844|Střelské Hoštice|Strakonice|2|905
00245534|Temelín|České Budějovice|2|905
00235628|Ovčáry|Kolín|1|904
00254410|Bečov nad Teplou|Karlovy Vary|4|903
00233749|Praskolesy|Beroun|1|903
00279625|Tatenice|Ústí nad Orlicí|8|903
00243680|Čistá|Rakovník|1|902
00291030|Korytná|Uherské Hradiště|12|902
00488046|Medlov|Brno - venkov|10|902
00281204|Vavřinec|Blansko|10|901
00236683|Žehušice|Kutná Hora|1|901
00277665|Bernartice|Trutnov|7|900
00576999|Pražmo|Frýdek - Místek|13|900
00635839|Střítež nad Bečvou|Vsetín|12|900
00302228|Všechovice|Přerov|11|900
00256544|Dnešice|Plzeň - jih|3|898
00245283|Olešnice|České Budějovice|2|897
00243191|Rosovice|Příbram|1|897
00298387|Spálov|Nový Jičín|13|897
00239135|Hradištko|Nymburk|1|896
00274038|Ostřetín|Pardubice|8|896
00286460|Puklice|Jihlava|9|896
00577014|Vyšní Lhoty|Frýdek - Místek|13|896
00275824|Karlovice|Semily|6|895
00288250|Horní Štěpánov|Prostějov|11|894
00235652|Přišimasy|Kolín|1|894
00304280|Růžďka|Vsetín|12|891
00534668|Strahovice|Opava|13|891
69171289|Rabštejnská Lhota|Chrudim|8|890
00291048|Kostelany nad Moravou|Uherské Hradiště|12|889
00251895|Štěkeň|Strakonice|2|889
00293971|Bobrová|Žďár nad Sázavou|9|888
00237621|Čistá|Mladá Boleslav|1|888
00299171|Luká|Olomouc|11|888
00272884|Nový Hrádek|Náchod|7|887
00291242|Podolí|Uherské Hradiště|12|887
00232238|Miličín|Benešov|1|885
00291218|Osvětimany|Uherské Hradiště|12|884
00276537|Cerekvice nad Loučnou|Svitavy|8|883
00272418|Vysoké Veselí|Jičín|7|883
00237612|Čachovice|Mladá Boleslav|1|882
00600385|Hrabětice|Znojmo|10|882
00244091|Mšec|Rakovník|1|882
00574155|Letkov|Plzeň - město|3|881
00542253|Břestek|Uherské Hradiště|12|880
00556327|Jimlín|Louny|5|880
66109973|Velké Chvojno|Ústí nad Labem|5|880
00247502|Stráž nad Nežárkou|Jindřichův Hradec|2|879
00238996|Bobnice|Nymburk|1|878
00488283|Přísnotice|Brno - venkov|10|878
00600806|Skotnice|Nový Jičín|13|878
00274861|Dobré|Rychnov nad Kněžnou|7|876
00302961|Lukavice|Šumperk|11|876
00255416|Dlouhá Ves|Klatovy|3|875
00292125|Nemojany|Vyškov|10|875
00266639|Újezdeček|Teplice|5|875
00241385|Kosoř|Praha - západ|1|874
00241482|Měchenice|Praha - západ|1|873
00555444|Horní Libchava|Česká Lípa|6|872
00238988|Běrunice|Nymburk|1|871
00246441|Český Rudolec|Jindřichův Hradec|2|871
00254789|Merklín|Karlovy Vary|4|871
00488097|Nebovidy|Brno - venkov|10|871
00286311|Nová Říše|Jihlava|9|871
00296414|Třemešná|Bruntál|13|871
00299065|Kožušany-Tážaly|Olomouc|11|870
00534722|Kyjovice|Opava|13|870
00232271|Mrač|Benešov|1|870
00293415|Prosiměřice|Znojmo|10|869
00286265|Mrákotín|Jihlava|9|868
00581941|Vrábče|České Budějovice|2|868
00576905|Smilovice|Frýdek - Místek|13|867
00635685|Štarnov|Olomouc|11|867
00233889|Tetín|Beroun|1|867
00287482|Martinice|Kroměříž|12|866
00302023|Střítež nad Ludinou|Přerov|11|866
00275395|Slatina nad Zdobnicí|Rychnov nad Kněžnou|7|865
00275590|Benešov u Semil|Semily|6|864
00290874|Bystřice pod Lopeníkem|Uherské Hradiště|12|864
00298735|Bystročice|Olomouc|11|863
00267678|Kožlí|Havlíčkův Brod|9|863
00302619|Hrabišín|Šumperk|11|862
00276693|Chornice|Svitavy|8|861
00294268|Doubravník|Brno - venkov|10|861
00263168|Rynoltice|Liberec|6|861
00284751|Archlebov|Hodonín|10|860
00285005|Kostelec|Hodonín|10|860
00261769|Vilémov|Děčín|5|859
00535125|Horní Lhota|Ostrava - město|13|858
00267791|Libice nad Doubravou|Havlíčkův Brod|9|858
00252191|Dolní Hořice|Tábor|2|857
00261858|Droužkovice|Chomutov|5|857
00266361|Jeníkov|Teplice|5|857
00233684|Osek|Beroun|1|857
00581020|Rybník|Ústí nad Orlicí|8|857
00283576|Sedlec|Břeclav|10|857
00245828|Černá v Pošumaví|Český Krumlov|2|856
00288284|Hrubčice|Prostějov|11|855
00662178|Tuhaň|Mělník|1|855
00290696|Výčapy|Třebíč|9|855
00284700|Vysoké Pole|Zlín|12|855
00289329|Dukovany|Třebíč|9|854
00266884|Malečov|Ústí nad Labem|5|854
00580589|Němčice|Pardubice|8|854
00249050|Senožaty|Pelhřimov|9|854
00850641|Týn nad Bečvou|Přerov|11|854
00488305|Silůvky|Brno - venkov|10|853
00257508|Žinkovy|Plzeň - jih|3|853
00542431|Křižanovice|Vyškov|10|852
00259284|Citice|Sokolov|4|851
00226203|Veselá|Zlín|12|851
00273678|Chvojenec|Pardubice|8|850
00262323|Frýdštejn|Jablonec nad Nisou|6|850
00287580|Pačlavice|Kroměříž|12|849
00285234|Radějov|Hodonín|10|849
00300675|Služovice|Opava|13|849
00303666|Zvole|Šumperk|11|849
00303879|Jarcová|Vsetín|12|848
00568627|Lípa|Zlín|12|848
00290637|Valeč|Třebíč|9|848
00235202|Žilina|Kladno|1|848
00302325|Bernartice|Jeseník|11|846
00252239|Dražice|Tábor|2|846
00244112|Mutějovice|Rakovník|1|846
00239798|Stará Lysá|Nymburk|1|846
00295493|Strážek|Žďár nad Sázavou|9|846
00283029|Borkovany|Břeclav|10|845
00235423|Jevany|Praha - východ|1|845
00285153|Násedlovice|Hodonín|10|845
00281077|Šebrov - Kateřina|Blansko|10|845
00256242|Velhartice|Klatovy|3|845
00510530|Káraný|Praha - východ|1|844
00372081|Hostěrádky - Rešov|Vyškov|10|843
00262943|Křižany|Liberec|6|843
00637530|Nová Ves|Brno - venkov|10|843
00276251|Víchová nad Jizerou|Semily|6|843
00292770|Hluboké Mašůvky|Znojmo|10|842
00237981|Katusice|Mladá Boleslav|1|842
00254762|Kyselka|Karlovy Vary|4|841
00239941|Všechlapy|Nymburk|1|841
00481483|Oldřichov v Hájích|Liberec|6|840
00260878|Jestřebí|Česká Lípa|6|839
00488038|Malešovice|Brno - venkov|10|838
00283606|Strachotín|Břeclav|10|838
00266574|Rtyně nad Bílinou|Teplice|5|837
00285285|Sobůlky|Hodonín|10|837
62351290|Vražné|Nový Jičín|13|837
00240991|Vodochody|Praha - východ|1|836
00290360|Rokytnice nad Rokytnou|Třebíč|9|835
00264539|Třebívlice|Litoměřice|5|835
00278165|Nemojov|Trutnov|7|834
00488151|Hostěnice|Brno - venkov|10|833
00243884|Kolešovice|Rakovník|1|833
00303968|Lačnov|Vsetín|12|833
00285072|Lovčice|Hodonín|10|833
00245798|Besednice|Český Krumlov|2|832
00254398|Abertamy|Karlovy Vary|4|831
00281069|Šebetov|Blansko|10|831
00488232|Omice|Brno - venkov|10|829
00377155|Ostrovačice|Brno - venkov|10|829
00284386|Racková|Zlín|12|829
00374903|Řícmanice|Brno - venkov|10|828
00304107|Mikulůvka|Vsetín|12|827
00640719|Klínec|Praha - západ|1|826
00256021|Předslav|Klatovy|3|826
00236128|Chotusice|Kutná Hora|1|825
00524221|Horní Podluží|Děčín|5|825
00236624|Záboří nad Labem|Kutná Hora|1|825
00508381|Bukovany|Benešov|1|824
00277771|Dolní Lánov|Trutnov|7|824
00233374|Karlštejn|Beroun|1|824
00580899|Dlouhoňovice|Ústí nad Orlicí|8|823
00288349|Klenovice na Hané|Prostějov|11|823
00303305|Rovensko|Šumperk|11|823
00268453|Věž|Havlíčkův Brod|9|823
00235938|Vyžlovka|Praha - východ|1|823
00245291|Olešník|České Budějovice|2|822
00279650|Třebovice|Ústí nad Orlicí|8|822
00241539|Petrov|Praha - západ|1|821
00295329|Rožná|Žďár nad Sázavou|9|821
00535117|Těškovice|Opava|13|821
00280429|Křtiny|Blansko|10|819
00260126|Rozvadov|Tachov|3|818
00255211|Běšiny|Klatovy|3|817
00271764|Libuň|Jičín|7|817
00238635|Smilovice|Mladá Boleslav|1|817
00640727|Úholičky|Praha - západ|1|817
00274801|Černíkovice|Rychnov nad Kněžnou|7|816
00281972|Lažánky|Brno - venkov|10|816
00270547|Morašice|Chrudim|8|816
00260789|Nový Oldřichov|Česká Lípa|6|816
00261360|Huntířov|Děčín|5|815
00232068|Křečovice|Benešov|1|815
00252794|Ratibořské Hory|Tábor|2|815
00233218|Drozdov|Beroun|1|814
00278874|Hnátnice|Ústí nad Orlicí|8|814
00296015|Horní Město|Bruntál|13|814
00239348|Krchleby|Nymburk|1|814
00253049|Tučapy|Tábor|2|813
00281352|Žďárná|Blansko|10|813
00573001|Bdeněves|Plzeň - sever|3|812
00259870|Chodský Újezd|Tachov|3|812
00292109|Němčany|Vyškov|10|811
00253871|Všeruby|Domažlice|3|810
00272710|Chvalkovice|Náchod|7|809
00290947|Horní Němčí|Uherské Hradiště|12|809
00232335|Nespeky|Benešov|1|808
00269433|Roudnice|Hradec Králové|7|808
00258695|Ejpovice|Rokycany|3|807
00264024|Martiněves|Litoměřice|5|807
00292583|Břežany|Znojmo|10|806
00301809|Prosenice|Přerov|11|806
00290815|Boršice u Blatnice|Uherské Hradiště|12|805
00281883|Jinačovice|Brno - venkov|10|805
00254037|Libá|Cheb|4|805
00241504|Okrouhlo|Praha - západ|1|805
00293385|Práče|Znojmo|10|805
00282880|Zakřany|Brno - venkov|10|805
00635413|Budišovice|Opava|13|804
00237591|Bukovno|Mladá Boleslav|1|804
00242764|Mokrovraty|Příbram|1|804
00301655|Opatovice|Přerov|11|804
00241440|Líšnice|Praha - západ|1|803
00270636|Orel|Chrudim|8|803
00240613|Polerady|Praha - východ|1|803
00295761|Vojnův Městec|Žďár nad Sázavou|9|803
00235121|Vraný|Kladno|1|803
00243582|Vysoký Chlumec|Příbram|1|803
00283410|Nikolčice|Břeclav|10|802
00244333|Ruda|Rakovník|1|802
00250244|Záhoří|Písek|2|802
00840670|Polnička|Žďár nad Sázavou|9|801
00287971|Žeranovice|Kroměříž|12|801
00508519|Čtyřkoly|Benešov|1|800
00270105|Holetín|Chrudim|8|800
00239119|Hořátev|Nymburk|1|799
00276855|Korouhev|Svitavy|8|799
00234745|Otvovice|Kladno|1|799
00270750|Prosetín|Chrudim|8|799
00577081|Vojkovice|Frýdek - Místek|13|799
00362531|Babice u Rosic|Brno - venkov|10|798
00288055|Brodek u Konice|Prostějov|11|798
00288187|Dobromilice|Prostějov|11|797
00292168|Nížkovice|Vyškov|10|797
00542300|Ořechov|Uherské Hradiště|12|797
00274704|Bílý Újezd|Rychnov nad Kněžnou|7|796
00301141|Černotín|Přerov|11|796
00600725|Hostašovice|Nový Jičín|13|796
00242292|Hvožďany|Příbram|1|796
00290203|Přibyslavice|Třebíč|9|796
00259608|Staré Sedlo|Sokolov|4|796
00255556|Chanovice|Klatovy|3|795
00849731|Dobroslavice|Opava|13|795
00292931|Jezeřany-Maršovice|Znojmo|10|795
00248746|Obrataň|Pelhřimov|9|795
00279706|Verměřovice|Ústí nad Orlicí|8|795
00255246|Bolešiny|Klatovy|3|794
00283487|Perná|Břeclav|10|794
00191159|Srnojedy|Pardubice|8|793
00236144|Kácov|Kutná Hora|1|792
00257729|Druztová|Plzeň - sever|3|791
00483095|Liběšice|Louny|5|791
00293806|Vranov nad Dyjí|Znojmo|10|791
00277657|Batňovice|Trutnov|7|790
00245208|Ločenice|České Budějovice|2|790
00576964|Malenovice|Frýdek - Místek|13|790
00283533|Pouzdřany|Břeclav|10|790
00238562|Řepov|Mladá Boleslav|1|790
00487520|Radostice|Brno - venkov|10|789
00246212|Zlatá Koruna|Český Krumlov|2|789
00271438|Cerekvice nad Bystřicí|Jičín|7|787
00232181|Maršovice|Benešov|1|786
00258067|Líšťany|Plzeň - sever|3|785
00281301|Vysočany|Blansko|10|785
00372102|Hrušky|Vyškov|10|784
00279170|Líšnice|Ústí nad Orlicí|8|784
00291145|Nedachlebice|Uherské Hradiště|12|784
00268348|Šlapanov|Havlíčkův Brod|9|784
00291331|Starý Hrozenkov|Uherské Hradiště|12|784
00279790|Záchlumí|Ústí nad Orlicí|8|784
00260657|Kravaře|Česká Lípa|6|783
00283801|Bratřejov|Zlín|12|782
00256714|Chválenice|Plzeň - město|3|782
00270245|Kameničky|Chrudim|8|782
00284378|Provodov|Zlín|12|781
68898797|Lhota u Vsetína|Vsetín|12|780
00264385|Snědovice|Litoměřice|5|780
00242799|Nečín|Příbram|1|779
00239593|Pátek|Nymburk|1|779
00849740|Větřkovice|Opava|13|779
00235342|Dobřichov|Kolín|1|778
00282871|Vysoké Popovice|Brno - venkov|10|777
00235571|Nebovidy|Kolín|1|776
00252964|Sudoměřice u Bechyně|Tábor|2|776
00302392|Bohutín|Šumperk|11|775
00280071|Cetkovice|Blansko|10|775
00236110|Chlístovice|Kutná Hora|1|774
00234231|Cvrčovice|Kladno|1|774
00252468|Košice|Tábor|2|774
00283550|Přítluky|Břeclav|10|774
00600661|Slatina|Nový Jičín|13|774
00848441|Trnávka|Nový Jičín|13|774
00273155|Velichovky|Náchod|7|774
00581810|Nová Ves|České Budějovice|2|773
00283461|Pasohlávky|Brno - venkov|10|773
00290386|Rudíkov|Třebíč|9|772
00240354|Kostelec u Křížků|Praha - východ|1|770
00304069|Loučka|Vsetín|12|770
00253421|Chodov|Domažlice|3|769
00488364|Velatice|Brno - venkov|10|769
00283843|Březůvky|Zlín|12|768
00291897|Komořany|Vyškov|10|767
00259420|Královské Poříčí|Sokolov|4|766
00368725|Vážany nad Litavou|Vyškov|10|766
00294055|Bory|Žďár nad Sázavou|9|765
00235407|Chrášťany|Kolín|1|764
00851841|Janová|Vsetín|12|764
00285421|Uhřice|Hodonín|10|764
00268747|Dolní Přím|Hradec Králové|7|763
00600792|Mošnov|Nový Jičín|13|763
00295451|Sněžné|Žďár nad Sázavou|9|763
00275433|Trnov|Rychnov nad Kněžnou|7|763
00240125|Čestlice|Praha - východ|1|762
00290068|Opatov|Třebíč|9|762
00290599|Trnava|Třebíč|9|762
00568694|Poteč|Zlín|12|761
00258750|Cheznovice|Rokycany|3|759
00255599|Chudenice|Klatovy|3|759
00272621|Dolní Radechová|Náchod|7|758
00279218|Luková|Ústí nad Orlicí|8|757
00240176|Dřevčice|Praha - východ|1|756
00842524|Oslavice|Žďár nad Sázavou|9|756
00288624|Pivín|Prostějov|11|756
00283401|Němčičky|Břeclav|10|755
00303844|Choryně|Vsetín|12|754
00246506|Deštná|Jindřichův Hradec|2|754
00600164|Ivaň|Brno - venkov|10|754
00238597|Semčice|Mladá Boleslav|1|754
00279811|Zámrsk|Ústí nad Orlicí|8|754
00237841|Hrdlořezy|Mladá Boleslav|1|753
00248444|Košetice|Pelhřimov|9|752
00288616|Pěnčín|Prostějov|11|752
00291994|Lovčičky|Vyškov|10|751
00575658|Nová Hradečná|Olomouc|11|751
00274321|Staré Ždánice|Pardubice|8|751
00239828|Stratov|Nymburk|1|750
00235211|Žižice|Kladno|1|750
00233650|Nový Jáchymov|Beroun|1|749
00637637|Troskotovice|Brno - venkov|10|749
00279749|Vraclav|Ústí nad Orlicí|8|748
00271471|Dětenice|Jičín|7|747
00254045|Lipová|Cheb|4|747
00240761|Sluštice|Praha - východ|1|747
00273007|Rychnovek|Náchod|7|746
00287903|Záříčí|Kroměříž|12|746
00635464|Děhylov|Opava|13|745
00247715|Volfířov|Jindřichův Hradec|2|744
00640115|Čakovičky|Mělník|1|743
00231771|Heřmaničky|Benešov|1|743
00240753|Sluhy|Praha - východ|1|743
00283789|Bohuslavice u Zlína|Zlín|12|742
00268763|Hlušice|Hradec Králové|7|742
00236187|Křesetice|Kutná Hora|1|742
00555916|Markvartice|Děčín|5|742
00245429|Slavče|České Budějovice|2|742
00831468|Dětřichov|Liberec|6|741
00236543|Úžice|Kutná Hora|1|741
00273163|Velká Jesenice|Náchod|7|740
00270288|Kočí|Chrudim|8|739
00261076|Volfartice|Česká Lípa|6|738
00246387|Budíškovice|Jindřichův Hradec|2|736
00272612|Dolany|Náchod|7|736
00579602|Opatovec|Svitavy|8|736
00277029|Morašice|Svitavy|8|735
60798416|Olbramice|Ostrava - město|13|735
00234966|Svinařov|Kladno|1|734
00295990|Holčovice|Bruntál|13|733
00258806|Kařez|Rokycany|3|733
00244422|Slabce|Rakovník|1|733
00524662|Horní Police|Česká Lípa|6|732
00266043|Louka u Litvínova|Most|5|732
00272736|Jasenná|Náchod|7|731
00526045|Malé Žernoseky|Litoměřice|5|730
00635308|Mladějovice|Olomouc|11|730
00234362|Horní Bezděkov|Kladno|1|729
00269077|Lovčice|Hradec Králové|7|729
00251461|Malenice|Strakonice|2|729
00234222|Tuřany|Kladno|1|729
00249416|Vyskytná|Pelhřimov|9|729
00263664|Hrobce|Litoměřice|5|728
00249891|Nadějkov|Tábor|2|728
00263699|Chodouny|Litoměřice|5|727
00258229|Pernarec|Plzeň - sever|3|727
00257354|Útušice|Plzeň - jih|3|727
00542440|Zbýšov|Vyškov|10|727
00249742|Kestřany|Písek|2|726
00276839|Koclířov|Svitavy|8|726
00663000|Trhové Dušníky|Příbram|1|726
00284637|Velký Ořechov|Zlín|12|725
00252107|Borotín|Tábor|2|723
00242934|Obořiště|Příbram|1|723
00295540|Škrdlovice|Žďár nad Sázavou|9|723
00275506|Voděrady|Rychnov nad Kněžnou|7|723
00283088|Bulhary|Břeclav|10|722
00278980|Jamné nad Orlicí|Ústí nad Orlicí|8|722
00284211|Mysločovice|Zlín|12|722
00301710|Pavlovice u Přerova|Přerov|11|722
00245003|Chrášťany|České Budějovice|2|721
00299219|Mladeč|Olomouc|11|721
00524760|Provodín|Česká Lípa|6|721
00524212|Rybniště|Děčín|5|721
00268275|Sobíňov|Havlíčkův Brod|9|721
00635855|Velká Kraš|Jeseník|11|721
00368717|Kobeřice u Brna|Vyškov|10|720
00285510|Žádovice|Hodonín|10|720
00573191|Březová|Karlovy Vary|4|719
00299006|Cholina|Olomouc|11|719
00237175|Řepín|Mělník|1|719
00262064|Otvice|Chomutov|5|718
00255394|Dešenice|Klatovy|3|717
00251437|Lnáře|Strakonice|2|717
00257001|Neurazy|Plzeň - jih|3|717
00279315|Ostrov|Ústí nad Orlicí|8|717
00284157|Ludkovice|Zlín|12|716
00292052|Milešovice|Vyškov|10|716
00287491|Míškovice|Kroměříž|12|716
70541981|Skorkov|Mladá Boleslav|1|716
00295558|Štěpánov nad Svratkou|Žďár nad Sázavou|9|716
00509655|Chodouň|Beroun|1|715
00288438|Lipová|Prostějov|11|715
00243531|Voznice|Příbram|1|715
00263095|Pěnčín|Liberec|6|714
00268062|Pohled|Havlíčkův Brod|9|714
00238902|Všejany|Mladá Boleslav|1|714
00637688|Hajany|Brno - venkov|10|713
00268801|Hořiněves|Hradec Králové|7|713
00635448|Štáblovice|Opava|13|713
00488356|Unkovice|Brno - venkov|10|713
00241334|Jíloviště|Praha - západ|1|712
00247014|Lodhéřov|Jindřichův Hradec|2|712
00240974|Větrušice|Praha - východ|1|712
00240087|Brázdim|Praha - východ|1|711
00285862|Hodice|Jihlava|9|711
00303151|Písařov|Šumperk|11|711
00525677|Sloup v Čechách|Česká Lípa|6|711
00243507|Višňová|Příbram|1|711
00580601|Černá u Bohdanče|Pardubice|8|710
00542326|Pašovice|Uherské Hradiště|12|710
00292222|Prusy-Boškůvky|Vyškov|10|710
00261009|Svor|Česká Lípa|6|710
00283878|Dolní Lhota|Zlín|12|709
00281719|Domašov|Brno - venkov|10|709
00302791|Kolšov|Šumperk|11|709
00576883|Horní Tošanovice|Frýdek - Místek|13|708
00842478|Lavičky|Žďár nad Sázavou|9|708
00636061|Hrabová|Šumperk|11|707
00284955|Ježov|Hodonín|10|707
00301523|Lobodice|Přerov|11|706
00291161|Nezdenice|Uherské Hradiště|12|706
00295621|Věcov|Žďár nad Sázavou|9|706
00256897|Lužany|Plzeň - jih|3|705
00544566|Pravčice|Kroměříž|12|705
00246093|Přídolí|Český Krumlov|2|705
00261092|Zahrádky|Česká Lípa|6|705
00266540|Ohníč|Teplice|5|704
00268411|Úsobí|Havlíčkův Brod|9|704
00573167|Krásno|Sokolov|4|702
00236993|Ledčice|Mělník|1|702
00568651|Machová|Zlín|12|702
00272973|Rasošky|Náchod|7|702
00236772|Čečelice|Mělník|1|701
00554839|Sulejovice|Litoměřice|5|701
00271217|Vysočina|Chrudim|8|701
00512672|Klenovice|Tábor|2|700
00278181|Pec pod Sněžkou|Trutnov|7|700
00234796|Pletený Újezd|Kladno|1|700
00291315|Slavkov|Uherské Hradiště|12|700
00278696|Damníkov|Ústí nad Orlicí|8|699
00242225|Hluboš|Příbram|1|699
00577022|Krásná|Frýdek - Místek|13|698
00250571|Malovice|Prachatice|2|698
00362344|Modrá|Uherské Hradiště|12|698
00285129|Moravany|Hodonín|10|698
64990940|Mrsklesy|Olomouc|11|698
00267074|Telnice|Ústí nad Labem|5|698
00265624|Tuchořice|Louny|5|698
00831417|Bílý Potok|Liberec|6|697
00576263|Bukovany|Olomouc|11|697
00600784|Kateřinice|Nový Jičín|13|697
00488071|Pravlov|Brno - venkov|10|697
00636380|Měrovice nad Hanou|Přerov|11|696
00287601|Počenice-Tetětice|Kroměříž|12|696
00287695|Roštín|Kroměříž|12|696
00241024|Vyšehořovice|Praha - východ|1|696
00283771|Biskupice|Zlín|12|695
00235296|Býchory|Kolín|1|695
00279447|Řetová|Ústí nad Orlicí|8|695
00280917|Sebranice|Blansko|10|695
00600814|Albrechtičky|Nový Jičín|13|694
00600407|Chvalovice|Znojmo|10|694
00266426|Lahošť|Teplice|5|694
00292265|Rašovice|Vyškov|10|694
00488127|Bratčice|Brno - venkov|10|693
00294829|Moravec|Žďár nad Sázavou|9|693
00276154|Stružinec|Semily|6|693
00293768|Vémyslice|Znojmo|10|693
00274623|Zdechovice|Pardubice|8|693
00673374|Sosnová|Česká Lípa|6|692
00284793|Bukovany|Hodonín|10|691
00243809|Chrášťany|Rakovník|1|691
00277762|Dolní Kalná|Trutnov|7|691
00256820|Letiny|Plzeň - jih|3|691
00247171|Novosedly nad Nežárkou|Jindřichův Hradec|2|691
00273899|Libišany|Pardubice|8|690
00636690|Šošůvka|Blansko|10|690
00289132|Březník|Třebíč|9|689
00600172|Jevišovka|Břeclav|10|688
00236519|Tupadly|Kutná Hora|1|688
00279293|Orlické Podhůří|Ústí nad Orlicí|8|687
00255963|Pačejov|Klatovy|3|687
00239704|Ratenice|Kolín|1|687
00849685|Chvalíkovice|Opava|13|686
00277801|Dubenec|Trutnov|7|686
00245976|Lipno nad Vltavou|Český Krumlov|2|686
00244007|Lišany|Rakovník|1|685
00289949|Myslibořice|Třebíč|9|685
00226220|Návojná|Zlín|12|685
00253651|Osvračín|Domažlice|3|685
00243493|Věšín|Příbram|1|684
00274151|Rohovládova Bělá|Pardubice|8|683
00261831|Černovice|Chomutov|5|682
00233951|Újezd|Beroun|1|682
00302732|Jestřebí|Šumperk|11|681
00239844|Tatce|Kolín|1|680
00235814|Tuchoraz|Kolín|1|680
00637343|Bohutice|Znojmo|10|679
00635596|Hlavnice|Opava|13|679
00635871|Nemile|Šumperk|11|679
00275948|Nová Ves nad Popelkou|Semily|6|679
00279927|Benešov|Blansko|10|678
00246450|Číměř|Jindřichův Hradec|2|678
00289493|Jakubov u Moravských Budějovic|Třebíč|9|678
46744959|Jeřmanice|Liberec|6|678
00275051|Liberk|Rychnov nad Kněžnou|7|678
00233731|Podluhy|Beroun|1|678
00290181|Předín|Třebíč|9|678
00233439|Kublov|Beroun|1|677
00282031|Lukovany|Brno - venkov|10|677
00600865|Vlkoš|Přerov|11|677
00362875|Hradčany|Brno - venkov|10|676
00245160|Lipí|České Budějovice|2|676
00363197|Lomnička|Brno - venkov|10|676
00226211|Nedašova Lhota|Zlín|12|675
00842630|Nová Ves u Nového Města na Moravě|Žďár nad Sázavou|9|675
00275263|Pohoří|Rychnov nad Kněžnou|7|675
00243973|Křivoklát|Rakovník|1|674
00374466|Sázava|Žďár nad Sázavou|9|674
00276138|Slaná|Semily|6|674
00600156|Cvrčovice|Brno - venkov|10|673
00303984|Leskovec|Vsetín|12|673
00555207|Podsedice|Litoměřice|5|673
00301949|Skalička|Přerov|11|673
00290581|Tasov|Žďár nad Sázavou|9|673
00277720|Černý Důl|Trutnov|7|672
00294179|Dalečín|Žďár nad Sázavou|9|672
00280933|Skalice nad Svitavou|Blansko|10|672
00488178|Kovalovice|Brno - venkov|10|671
00270571|Načešice|Chrudim|8|671
00295311|Rozsochy|Žďár nad Sázavou|9|671
00282545|Sentice|Brno - venkov|10|671
43750648|Tehovec|Praha - východ|1|671
00231886|Chotýšany|Benešov|1|670
45978140|Librantice|Hradec Králové|7|670
00256935|Mladý Smolivec|Plzeň - jih|3|670
00288489|Myslejovice|Prostějov|11|670
00287687|Roštění|Kroměříž|12|670
00600687|Bordovice|Nový Jičín|13|669
00267473|Hněvkovice|Havlíčkův Brod|9|669
00303135|Pavlov|Šumperk|11|669
00256536|Čížkov|Plzeň - jih|3|668
00640336|Hlízov|Kutná Hora|1|668
00278262|Staré Buky|Trutnov|7|668
00542261|Sušice|Uherské Hradiště|12|668
00249645|Drhovle|Písek|2|667
00275689|Háje nad Jizerou|Semily|6|667
00277070|Oldřiš|Svitavy|8|667
00581844|Pištín|České Budějovice|2|667
00269492|Skalice|Hradec Králové|7|667
00255602|Chudenín|Klatovy|3|666
00568724|Sehradice|Zlín|12|666
00257451|Zdemyslice|Plzeň - jih|3|666
00636126|Beňov|Přerov|11|665
00240583|Panenské Břežany|Praha - východ|1|665
00239585|Ostrá|Nymburk|1|664
00287733|Slavkov pod Hostýnem|Kroměříž|12|664
70287066|Spešov|Blansko|10|664
00293598|Štítary|Znojmo|10|664
00600695|Zbyslavice|Ostrava - město|13|664
48804711|Životice u Nového Jičína|Nový Jičín|13|664
00300420|Melč|Opava|13|662
00637475|Oleksovice|Znojmo|10|662
00255033|Šemnice|Karlovy Vary|4|662
00257541|Bezvěrov|Plzeň - sever|3|661
00488488|Javorník|Hodonín|10|661
70040915|Jezernice|Přerov|11|661
00271641|Jičíněves|Jičín|7|661
00663964|Lhota|Kladno|1|661
00232173|Louňovice pod Blaníkem|Benešov|1|661
00251631|Osek|Strakonice|2|661
00265497|Slavětín|Louny|5|661
00242829|Nechvalice|Příbram|1|660
00235709|Rostoklaty|Kolín|1|660
00842133|Jámy|Žďár nad Sázavou|9|659
00261416|Jiřetín pod Jedlovou|Děčín|5|659
00635863|Skorošice|Jeseník|11|659
00295744|Vír|Žďár nad Sázavou|9|659
00277967|Janské Lázně|Trutnov|7|658
00302716|Jedlí|Šumperk|11|658
00243035|Pičín|Příbram|1|658
00373583|Tučapy|Vyškov|10|658
00278670|České Libchavy|Ústí nad Orlicí|8|657
00283169|Horní Bojanovice|Břeclav|10|657
00244104|Mšecké Žehrovice|Rakovník|1|657
00515817|Rynárec|Pelhřimov|9|657
00640123|Březí|Praha - východ|1|656
00239011|Budiměřice|Nymburk|1|656
00635367|Blatec|Olomouc|11|655
00273546|Dříteč|Pardubice|8|655
00288306|Hvozd|Prostějov|11|655
00534650|Bělá|Opava|13|654
00488321|Sobotovice|Brno - venkov|10|654
00243418|Tochovice|Příbram|1|654
00273279|Žďár nad Metují|Náchod|7|654
00287253|Kostelany|Kroměříž|12|653
00275069|Lično|Rychnov nad Kněžnou|7|653
00636771|Petrovice|Blansko|10|653
00635626|Tovéř|Olomouc|11|653
00286842|Větrný Jeníkov|Jihlava|9|653
00275531|Záměl|Rychnov nad Kněžnou|7|653
00236047|Červené Janovice|Kutná Hora|1|652
00292818|Horní Dunajovice|Znojmo|10|652
00250538|Lenora|Prachatice|2|652
00254975|Stanovice|Karlovy Vary|4|652
00274721|Bolehošť|Rychnov nad Kněžnou|7|651
00532100|Bukovinka|Blansko|10|651
00233498|Libomyšl|Beroun|1|651
00269131|Měník|Hradec Králové|7|651
00293148|Mikulovice|Znojmo|10|651
00243388|Svatý Jan|Příbram|1|651
00295817|Zvole|Žďár nad Sázavou|9|651
00258652|Bušovice|Rokycany|3|650
00556297|Holedeč|Louny|5|650
00267813|Lipnice nad Sázavou|Havlíčkův Brod|9|650
00263303|Všelibice|Liberec|6|650
00241377|Kněževes|Praha - západ|1|649
00635812|Kunovice|Vsetín|12|649
00579301|Lukavice|Rychnov nad Kněžnou|7|649
00267830|Lučice|Havlíčkův Brod|9|648
00282413|Příbram na Moravě|Brno - venkov|10|648
00508365|Václavice|Benešov|1|648
00261246|Dobkovice|Děčín|5|647
00368067|Olšany|Vyškov|10|647
00261882|Chbany|Chomutov|5|646
00298921|Hnojice|Olomouc|11|646
00637360|Branišovice|Brno - venkov|10|645
00545406|Křoví|Žďár nad Sázavou|9|644
00269867|Bojanov|Chrudim|8|643
00255971|Petrovice u Sušice|Klatovy|3|643
00235644|Polepy|Kolín|1|643
67441513|Semanín|Ústí nad Orlicí|8|642
00573230|Hájek|Karlovy Vary|4|641
00278939|Horní Třešňovec|Ústí nad Orlicí|8|641
00279226|Mistrovice|Ústí nad Orlicí|8|641
00525707|Dubnice|Česká Lípa|6|640
00524301|Kunratice u Cvikova|Česká Lípa|6|640
00264229|Prackovice nad Labem|Litoměřice|5|640
00292290|Ruprechtov|Vyškov|10|640
00245488|Svatý Jan nad Malší|České Budějovice|2|640
00508926|Zdětín|Mladá Boleslav|1|640
00240591|Petříkov|Praha - východ|1|639
00264261|Račiněves|Litoměřice|5|639
00300713|Sudice|Opava|13|639
00375322|Ketkovice|Brno - venkov|10|638
00271543|Holín|Jičín|7|637
00273767|Kladruby nad Labem|Pardubice|8|637
00572969|Rybnice|Plzeň - sever|3|637
00296031|Hošťálkovy|Bruntál|13|636
00258156|Nečtiny|Plzeň - sever|3|636
00255157|Vojkovice|Karlovy Vary|4|636
00248002|Čejov|Pelhřimov|9|635
00277932|Choustníkovo Hradiště|Trutnov|7|635
00543713|Malý Beranov|Jihlava|9|635
00271942|Podhorní Újezd a Vojice|Jičín|7|635
00236365|Potěhy|Kutná Hora|1|635
00234885|Slatina|Kladno|1|635
00255017|Stružná|Karlovy Vary|4|635
00265918|Havraň|Most|5|634
00275077|Lípa nad Orlicí|Rychnov nad Kněžnou|7|634
00637629|Těšetice|Znojmo|10|634
00262200|Vilémov|Chomutov|5|634
00256676|Chocenice|Plzeň - jih|3|633
00286168|Krahulčí|Jihlava|9|633
00640794|Kytín|Praha - západ|1|633
00275280|Přepychy|Rychnov nad Kněžnou|7|633
44227531|Přestanov|Ústí nad Labem|5|633
00273066|Stárkov|Náchod|7|633
00264903|Domoušice|Louny|5|632
00299031|Jívová|Olomouc|11|632
00296201|Malá Morávka|Bruntál|13|632
00251739|Radošovice|Strakonice|2|632
00236608|Vlkaneč|Kutná Hora|1|632
00524743|Blíževedly|Česká Lípa|6|631
00264971|Hřivice|Louny|5|631
00600431|Krhovice|Znojmo|10|631
00244180|Olešná|Rakovník|1|631
00247375|Rodvínov|Jindřichův Hradec|2|631
00286648|Stará Říše|Jihlava|9|631
00290513|Studenec|Třebíč|9|631
00235156|Zákolany|Kladno|1|631
00366129|Železné|Brno - venkov|10|631
00635847|Bratrušov|Šumperk|11|630
00265071|Krásný Dvůr|Louny|5|630
00242608|Láz|Příbram|1|630
00250597|Nebahovy|Prachatice|2|630
00274224|Semín|Pardubice|8|630
00262561|Skuhrov|Jablonec nad Nisou|6|630
00302872|Lesnice|Šumperk|11|629
00245763|Žimutice|České Budějovice|2|629
00247987|Častrov|Pelhřimov|9|628
00285188|Nová Lhota|Hodonín|10|628
00258458|Úněšov|Plzeň - sever|3|628
00302422|Brníčko|Šumperk|11|627
00277941|Chvaleč|Trutnov|7|627
00248215|Hořepník|Pelhřimov|9|627
60798483|Jakubčovice nad Odrou|Nový Jičín|13|627
00262471|Maršovice|Jablonec nad Nisou|6|627
00279641|Tisová|Ústí nad Orlicí|8|627
00653691|Bezděkov nad Metují|Náchod|7|626
00245810|Bujanov|Český Krumlov|2|626
00244775|Dívčice|České Budějovice|2|626
00240303|Klíčany|Praha - východ|1|626
00302775|Klopina|Šumperk|11|626
00269344|Prasek|Hradec Králové|7|626
00574040|Štěnovický Borek|Plzeň - město|3|626
00572675|Krásná|Cheb|4|625
00277274|Rohozná|Svitavy|8|625
00293610|Šumná|Znojmo|10|625
00247855|Božejov|Pelhřimov|9|624
00635359|Daskabát|Olomouc|11|624
00237795|Horky nad Jizerou|Mladá Boleslav|1|624
00257931|Kozojedy|Plzeň - sever|3|624
00288721|Rozstání|Prostějov|11|624
00276936|Linhartice|Svitavy|8|623
00303429|Supíkovice|Jeseník|11|623
00242772|Nalžovice|Příbram|1|622
00372030|Drysice|Vyškov|10|621
00368733|Hoštice - Heroltice|Vyškov|10|621
00284921|Hrubá Vrbka|Hodonín|10|621
00635758|Liboš|Olomouc|11|621
00283479|Pavlov|Břeclav|10|621
61729639|Rostěnice - Zvonovice|Vyškov|10|621
00256617|Hradec|Plzeň - jih|3|620
00268968|Kratonohy|Hradec Králové|7|620
00243965|Krušovice|Rakovník|1|620
00232165|Loket|Benešov|1|620
00267856|Maleč|Havlíčkův Brod|9|620
00580805|Martinice v Krkonoších|Semily|6|620
00480975|Petrohrad|Louny|5|620
00257222|Soběkury|Plzeň - jih|3|620
00635553|Závada|Opava|13|620
00479292|Kostelec|Tachov|3|619
00271799|Lužany|Jičín|7|619
00272850|Nahořany|Náchod|7|619
00636584|Stará Ves|Přerov|11|619
00267481|Horní Krupá|Havlíčkův Brod|9|618
00672025|Jindřichovice pod Smrkem|Liberec|6|618
00240605|Podolanka|Praha - východ|1|618
00275751|Hrubá Skála|Semily|6|617
00239631|Pňov - Předhradí|Kolín|1|617
00288926|Vranovice-Kelčice|Prostějov|11|617
00276278|Všeň|Semily|6|617
00293083|Loděnice|Brno - venkov|10|616
00637254|Okrouhlá|Blansko|10|616
00544558|Rymice|Kroměříž|12|616
00875481|Svárov|Kladno|1|616
00244627|Zbečno|Rakovník|1|616
00249751|Kluky|Písek|2|615
00635651|Loučany|Olomouc|11|615
00250716|Svatá Maří|Prachatice|2|615
00276197|Tatobity|Semily|6|615
00851825|Ústí|Vsetín|12|615
00292591|Citonice|Znojmo|10|614
00555924|Dolní Habartice|Děčín|5|614
00234559|Koleč|Kladno|1|614
00295205|Radešínská Svratka|Žďár nad Sázavou|9|614
00261807|Blatno|Chomutov|5|613
00235466|Kořenice|Kolín|1|613
00640701|Trnová|Praha - západ|1|613
00256374|Žichovice|Klatovy|3|613
00304077|Lužná|Vsetín|12|612
00637203|Senetářov|Blansko|10|612
00278661|České Heřmanice|Ústí nad Orlicí|8|611
00672092|Čtveřín|Liberec|6|611
00265055|Koštice|Louny|5|611
00234583|Kyšice|Kladno|1|611
00271489|Dobrá Voda u Hořic|Jičín|7|610
00581381|Hůry|České Budějovice|2|610
00303291|Rohle|Šumperk|11|610
00876054|Hrubý Jeseník|Nymburk|1|609
00263982|Lovečkovice|Litoměřice|5|609
00635782|Pržno|Vsetín|12|609
47997265|Střeň|Olomouc|11|609
00264504|Travčice|Litoměřice|5|609
00568554|Horní Lhota|Zlín|12|608
00254941|Pšov|Karlovy Vary|4|608
00271080|Tuněchody|Chrudim|8|608
00510572|Zlončice|Mělník|1|608
00277983|Jívka|Trutnov|7|607
00277312|Rychnov na Moravě|Svitavy|8|607
00287776|Střílky|Kroměříž|12|607
00268445|Veselý Žďár|Havlíčkův Brod|9|607
48430749|Bílov|Nový Jičín|13|606
00264555|Třebušín|Litoměřice|5|606
00288942|Vrchoslavice|Prostějov|11|606
70565295|Sojovice|Mladá Boleslav|1|605
00283886|Doubravy|Zlín|12|604
00635804|Police|Vsetín|12|604
00288969|Výšovice|Prostějov|11|604
00285323|Strážovice|Hodonín|10|603
00242306|Chotilsko|Příbram|1|602
00250465|Chroboly|Prachatice|2|601
00296864|Lhotka|Frýdek - Místek|13|601
00666521|Rapšach|Jindřichův Hradec|2|601
00233633|Neumětely|Beroun|1|600
00635499|Rohov|Opava|13|600
00301965|Soběchleby|Přerov|11|600
00236659|Zbýšov|Kutná Hora|1|600
00268640|Boharyně|Hradec Králové|7|599
00662828|Háje|Příbram|1|599
00599841|Stránecká Zhoř|Žďár nad Sázavou|9|599
00279633|Těchonín|Ústí nad Orlicí|8|599
00241075|Zvánovice|Praha - východ|1|599
00239071|Dvory|Nymburk|1|598
00269069|Lochenice|Hradec Králové|7|598
00258202|Obora|Plzeň - sever|3|598
00475289|Předotice|Písek|2|598
00271594|Chomutice|Jičín|7|597
00276804|Kamenec u Poličky|Svitavy|8|597
00279544|Sruby|Ústí nad Orlicí|8|597
00639672|Svémyslice|Praha - východ|1|597
00263800|Kleneč|Litoměřice|5|596
00264997|Chlumčany|Louny|5|595
00640158|Modletice|Praha - východ|1|595
00235997|Bílé Podolí|Kutná Hora|1|594
00287474|Lutopecny|Kroměříž|12|594
00239739|Sány|Nymburk|1|594
00236551|Vavřinec|Kutná Hora|1|594
00581917|Vidov|České Budějovice|2|594
00287954|Zlobice|Kroměříž|12|594
00275662|Čistá u Horek|Semily|6|593
00257761|Horní Bělá|Plzeň - sever|3|593
00238155|Krnsko|Mladá Boleslav|1|593
00247260|Pluhův Žďár|Jindřichův Hradec|2|593
00579319|Podbřezí|Rychnov nad Kněžnou|7|593
00304204|Pozděchov|Vsetín|12|593
00295281|Rovečné|Žďár nad Sázavou|9|593
00233587|Mezouň|Beroun|1|592
00253570|Milavče|Domažlice|3|592
00292079|Moravské Málkovice|Vyškov|10|592
00576042|Moravskoslezský Kočov|Bruntál|13|592
00640239|Sedlec|Praha - východ|1|592
00234541|Knovíz|Kladno|1|591
00303356|Stará Červená Voda|Jeseník|11|591
00273244|Zábrodí|Náchod|7|591
00288764|Slatinky|Prostějov|11|590
00235016|Třebichovice|Kladno|1|590
00292982|Kravsko|Znojmo|10|589
00278203|Prosečné|Trutnov|7|589
00274135|Ráby|Pardubice|8|589
00233790|Skuhrov|Beroun|1|589
00580481|Svinčany|Pardubice|8|589
00573183|Božičany|Karlovy Vary|4|588
00234389|Hospozín|Kladno|1|588
00241253|Hvozdnice|Praha - západ|1|588
00278033|Kunčice nad Labem|Trutnov|7|588
00264075|Mnetěš|Litoměřice|5|588
00265292|Nové Sedlo|Louny|5|588
00253677|Pocinovice|Domažlice|3|588
00556017|Růžová|Děčín|5|588
00252930|Stádlec|Tábor|2|588
00287962|Žalkovice|Kroměříž|12|588
00581445|Libníč|České Budějovice|2|587
00600318|Dyjákovičky|Znojmo|10|586
00236748|Býkev|Mělník|1|585
00236870|Chvatěruby|Mělník|1|585
00279358|Písečná|Ústí nad Orlicí|8|585
00235776|Tismice|Kolín|1|585
00275611|Bozkov|Semily|6|584
00246492|Dešná|Jindřichův Hradec|2|584
00842443|Dolní Heřmanice|Žďár nad Sázavou|9|584
00665100|Hradešín|Kolín|1|584
00288403|Krumsín|Prostějov|11|584
00237191|Spomyšl|Mělník|1|584
00244473|Sýkořice|Rakovník|1|584
00509841|Trubín|Beroun|1|584
00264709|Žalhostice|Litoměřice|5|584
00273287|Žďárky|Náchod|7|584
00288993|Želeč|Prostějov|11|584
00254614|Chyše|Karlovy Vary|4|583
00294233|Dolní Rožínka|Žďár nad Sázavou|9|583
00285960|Jamné|Jihlava|9|583
00254878|Pernink|Karlovy Vary|4|583
00285501|Vřesovice|Hodonín|10|583
00265004|Chožov|Louny|5|582
00653594|Hejtmánkovice|Náchod|7|582
00246719|Horní Pěna|Jindřichův Hradec|2|582
00275930|Mříčná|Semily|6|582
00246034|Omlenice|Český Krumlov|2|582
00397342|Volenice|Strakonice|2|582
00233161|Bubovice|Beroun|1|581
00272671|Hořičky|Náchod|7|581
00263923|Libochovany|Litoměřice|5|581
00296325|Ryžoviště|Bruntál|13|581
00278718|Dobříkov|Ústí nad Orlicí|8|580
00262315|Držkov|Jablonec nad Nisou|6|580
00273821|Kostěnice|Pardubice|8|580
00673447|Okrouhlá|Česká Lípa|6|580
00255106|Útvina|Karlovy Vary|4|580
00234737|Olovnice|Mělník|1|579
70805202|Rokytnice|Zlín|12|579
00287709|Rusava|Kroměříž|12|579
00288951|Vřesovice|Prostějov|11|579
00291811|Hvězdlice|Vyškov|10|578
00241164|Dobrovíz|Praha - západ|1|577
69981264|Pila|Karlovy Vary|4|577
00241113|Černolice|Praha - západ|1|576
00257630|Česká Bříza|Plzeň - sever|3|576
00573744|Studánka|Tachov|3|576
00257435|Vstiš|Plzeň - jih|3|576
00262757|Dolní Řasnice|Liberec|6|575
00243761|Hředle|Rakovník|1|575
00483109|Lipno|Louny|5|575
00288837|Suchdol|Prostějov|11|575
00281191|Vanovice|Blansko|10|575
00264652|Vrbice|Litoměřice|5|575
00274828|Čestice|Rychnov nad Kněžnou|7|574
00635430|Hlubočec|Opava|13|574
00296040|Huzová|Olomouc|11|574
00244481|Šanov|Rakovník|1|574
00288888|Víceměřice|Prostějov|11|574
00239933|Vrbová Lhota|Nymburk|1|574
00242128|Drahlín|Příbram|1|573
00289337|Hartvíkovice|Třebíč|9|573
00235521|Křečhoř|Kolín|1|572
00232548|Pravonín|Benešov|1|572
00265446|Ročov|Louny|5|572
00568562|Hostišová|Zlín|12|571
67340474|Kujavy|Nový Jičín|13|571
00269841|Běstvina|Chrudim|8|570
00289264|Dalešice|Třebíč|9|570
00580929|Helvíkovice|Ústí nad Orlicí|8|570
00255009|Stráž nad Ohří|Karlovy Vary|4|570
00278441|Vlčice|Trutnov|7|570
00268721|Dobřenice|Hradec Králové|7|569
00303267|Rájec|Šumperk|11|569
00266051|Lužice|Most|5|568
00509043|Mečeříž|Mladá Boleslav|1|568
00258288|Přehýšov|Plzeň - sever|3|568
00252816|Roudná|Tábor|2|568
00271128|Včelákov|Chrudim|8|568
00256269|Velký Bor|Klatovy|3|568
00288896|Vícov|Prostějov|11|568
00288411|Laškov|Prostějov|11|567
00637424|Lechovice|Znojmo|10|567
48379701|Litohlavy|Rokycany|3|567
00262021|Mašťov|Chomutov|5|567
00241822|Vonoklasy|Praha - západ|1|567
00260525|Holany|Česká Lípa|6|566
00277321|Sádek|Svitavy|8|566
00256366|Žihobce|Klatovy|3|566
00271551|Holovousy|Jičín|7|565
00653381|Osice|Hradec Králové|7|565
00233803|Srbsko|Beroun|1|565
00289183|Čáslavice|Třebíč|9|564
00276588|Dlouhá Loučka|Svitavy|8|564
00239241|Kněžice|Nymburk|1|564
00261505|Lipová|Děčín|5|564
00239577|Oskořínek|Nymburk|1|564
00280879|Rozseč nad Kunštátem|Blansko|10|564
00637548|Přibyslavice|Brno - venkov|10|563
00512737|Střížovice|Jindřichův Hradec|2|563
00242373|Jesenice|Příbram|1|562
00640557|Malé Kyšice|Kladno|1|562
04498704|Libavá|Olomouc|11|560
00258121|Mladotice|Plzeň - sever|3|560
00239615|Písková Lhota|Nymburk|1|560
00266710|Dolní Zálezly|Ústí nad Labem|5|559
00515761|Olešná|Pelhřimov|9|559
00256528|Čižice|Plzeň - jih|3|558
00526461|Dobříň|Litoměřice|5|558
00243892|Kounov|Rakovník|1|558
00235695|Ratboř|Kolín|1|558
00281271|Voděrady|Blansko|10|558
00235911|Volárna|Kolín|1|558
00283045|Brod nad Dyjí|Břeclav|10|557
00271853|Mlázovice|Jičín|7|557
00232378|Neustupov|Benešov|1|557
00236861|Chorušice|Mělník|1|556
00236381|Rataje nad Sázavou|Kutná Hora|1|556
00579980|Nová Ves u Chotěboře|Havlíčkův Brod|9|555
00235792|Třebovle|Kolín|1|555
00636100|Chromeč|Šumperk|11|554
00234648|Lidice|Kladno|1|554
00271845|Mladějov|Jičín|7|554
60418559|Střítež|Třebíč|9|554
00304484|Zděchov|Vsetín|12|554
00488861|Kozojídky|Hodonín|10|553
00246972|Lásenice|Jindřichův Hradec|2|553
00267783|Leština u Světlé|Havlíčkův Brod|9|553
00576891|Řeka|Frýdek - Místek|13|553
65197887|Nová Ves u Světlé|Havlíčkův Brod|9|552
00243060|Počepice|Příbram|1|552
00250058|Putim|Písek|2|552
00296406|Široká Niva|Bruntál|13|552
00296384|Svobodné Heřmanice|Bruntál|13|552
00232823|Teplýšovice|Benešov|1|552
00258164|Nekmíř|Plzeň - sever|3|551
00277509|Trstěnice|Svitavy|8|551
00274844|Deštné v Orlických horách|Rychnov nad Kněžnou|7|550
00236152|Kluky|Kutná Hora|1|550
00293121|Mašovice|Znojmo|10|550
00853976|Sázava|Ústí nad Orlicí|8|550
00293636|Tavíkovice|Znojmo|10|549
00288802|Stařechovice|Prostějov|11|548
00372072|Hlubočany|Vyškov|10|546
00234401|Hradečno|Kladno|1|546
00378062|Litohoř|Třebíč|9|546
00568732|Slopné|Zlín|12|546
00233838|Suchomasty|Beroun|1|545
00662984|Svaté Pole|Příbram|1|545
00285889|Horní Dubenky|Jihlava|9|544
00240699|Řehenice|Benešov|1|544
00297241|Staré Hamry|Frýdek - Místek|13|544
00301451|Lazníky|Přerov|11|543
00254126|Nový Kostel|Cheb|4|543
00236535|Úmonín|Kutná Hora|1|543
00508527|Lštění|Benešov|1|542
00279234|Mladkov|Ústí nad Orlicí|8|542
00243116|Prosenická Lhota|Příbram|1|542
00268151|Rozsochatec|Havlíčkův Brod|9|542
00272094|Slatiny|Jičín|7|542
00304310|Střelná|Vsetín|12|542
00600008|Dětkovice|Prostějov|11|541
00240672|Radějovice|Praha - východ|1|541
00269565|Smržov|Hradec Králové|7|541
00302473|Černá Voda|Jeseník|11|539
00275565|OBEC ŽĎÁR N.O.|Rychnov nad Kněžnou|7|539
00266434|Ledvice|Teplice|5|538
00287041|Bezměrov|Kroměříž|12|537
47786663|Libočany|Louny|5|537
00252867|Skalice|Tábor|2|537
00261874|Hrušovany|Chomutov|5|536
00488551|Seloutky|Prostějov|11|536
00637017|Slup|Znojmo|10|536
00285463|Věteřov|Hodonín|10|536
00290335|Rapotice|Třebíč|9|535
00245461|Strážkovice|České Budějovice|2|535
00636657|Uhřičice|Přerov|11|535
00600849|Ústí|Přerov|11|535
00235415|Jestřabí Lhota|Kolín|1|534
00234681|Makotřasy|Kladno|1|534
00526088|Radovesice|Litoměřice|5|534
00245411|Sedlec|České Budějovice|2|534
00842656|Zubří|Žďár nad Sázavou|9|534
00301116|Citov|Přerov|11|533
00259373|Jindřichovice|Sokolov|4|533
00301701|Partutovice|Přerov|11|533
00287661|Rajnochovice|Kroměříž|12|533
00233846|Svatá|Beroun|1|533
00636886|Olbramkostel|Znojmo|10|532
00304409|Velká Lhota|Vsetín|12|532
00845132|Domaželice|Přerov|11|531
00288446|Ludmírov|Prostějov|11|531
00600776|Mankovice|Nový Jičín|13|531
00272663|Horní Radechová|Náchod|7|530
00509191|Boseň|Mladá Boleslav|1|529
00232009|Kondrac|Benešov|1|529
00288462|Mořice|Prostějov|11|529
00283380|Morkůvky|Břeclav|10|529
00239763|Sloveč|Nymburk|1|529
00250813|Vitějovice|Prachatice|2|529
00653497|Vysokov|Náchod|7|529
00283177|Horní Věstonice|Břeclav|10|528
00579611|Poříčí u Litomyšle|Svitavy|8|528
00190900|Spojil|Pardubice|8|528
00573809|Tisová|Tachov|3|527
00268461|Věžnice|Havlíčkův Brod|9|527
00671983|Lázně Libverda|Liberec|6|526
00653411|Sloupno|Hradec Králové|7|526
00239810|Straky|Nymburk|1|526
00637599|Suchohrdly u Miroslavi|Znojmo|10|526
00302287|Želatovice|Přerov|11|526
00263915|Libkovice pod Řípem|Litoměřice|5|525
00556891|Malé Březno|Ústí nad Labem|5|525
00636436|Olšovec|Přerov|11|525
00255041|Štědrá|Karlovy Vary|4|525
00271756|Libošovice|Jičín|7|524
00288101|Čehovice|Prostějov|11|523
00246409|Cizkrajov|Jindřichův Hradec|2|523
00288195|Doloplazy|Prostějov|11|523
00288209|Drahany|Prostějov|11|523
00542385|Veletiny|Uherské Hradiště|12|523
00239194|Chrást|Nymburk|1|522
00363278|Maršov|Brno - venkov|10|522
00272817|Martínkovice|Náchod|7|522
00247481|Staré Hobzí|Jindřichův Hradec|2|522
00235032|Třebusice|Kladno|1|522
00237001|Lhota|Praha - východ|1|521
00635588|Vršovice|Opava|13|521
00259462|Libavské Údolí|Sokolov|4|520
00293679|Trstěnice|Znojmo|10|520
00556238|Bitozeves|Louny|5|519
00283983|Hřivínův Újezd|Zlín|12|519
00653454|Jeníkovice|Hradec Králové|7|519
00278009|Kocbeře|Trutnov|7|519
00238104|Kosořice|Mladá Boleslav|1|519
00653403|Lužec nad Cidlinou|Hradec Králové|7|519
00235768|Svojšice|Kolín|1|519
00233315|Chaloupky|Beroun|1|518
00239046|Činěves|Nymburk|1|518
00238112|Kostelní Hlavno|Praha - východ|1|518
00271802|Markvartice|Jičín|7|518
00244520|Třtice|Rakovník|1|518
00274526|Valy|Pardubice|8|518
00237396|Želízy|Mělník|1|518
00246000|Mirkovice|Český Krumlov|2|517
00240541|Nový Vestec|Praha - východ|1|517
48706213|Studeněves|Kladno|1|517
00509213|Sudovo Hlavno|Praha - východ|1|517
00285544|Želetice|Hodonín|10|517
00237159|Ovčáry|Mělník|1|516
00235687|Radovesnice II|Kolín|1|516
00509353|Tuřice|Mladá Boleslav|1|516
00276308|Záhoří|Semily|6|516
00276511|Budislav|Svitavy|8|515
00238040|Kochánky|Mladá Boleslav|1|515
00293474|Skalice|Znojmo|10|515
00488879|Tasov|Hodonín|10|515
00555886|Velká Bukovina|Děčín|5|515
00233072|Zdislavice|Benešov|1|515
00288136|Čelčice|Prostějov|11|514
00288012|Bílovice-Lutotín|Prostějov|11|513
00573752|Lom u Tachova|Tachov|3|513
00360597|Drslavice|Uherské Hradiště|12|512
00234419|Hrdlív|Kladno|1|512
00275786|Jesenný|Semily|6|512
00239232|Kamenné Zboží|Nymburk|1|512
00287466|Ludslavice|Kroměříž|12|512
00572209|Trhanov|Domažlice|3|512
00264768|Blatno|Louny|5|511
00251038|Cehnice|Strakonice|2|511
00839574|Rančířov|Jihlava|9|511
00667161|Slapy|Tábor|2|511
00207438|Komňa|Uherské Hradiště|12|510
00275166|Ohnišov|Rychnov nad Kněžnou|7|510
00574201|Horní Lukavice|Plzeň - jih|3|509
00302970|Malá Morava|Šumperk|11|509
00635952|Velké Kunětice|Jeseník|11|509
00488615|Cejle|Jihlava|9|508
00526096|Chotěšov|Litoměřice|5|508
00600326|Dyje|Znojmo|10|508
00267694|Krásná Hora|Havlíčkův Brod|9|508
00635642|Luběnice|Olomouc|11|508
00304140|Oznice|Vsetín|12|508
00268402|Uhelná Příbram|Havlíčkův Brod|9|508
00535141|Čavisov|Ostrava - město|13|507
00249688|Hrejkovice|Písek|2|507
00258814|Klabava|Rokycany|3|507
00377732|Koněšín|Třebíč|9|507
00232041|Krňany|Benešov|1|507
00275859|Kruh|Semily|6|507
00488186|Kratochvilka|Brno - venkov|10|506
00255319|Čachrov|Klatovy|3|505
00283100|Diváky|Břeclav|10|505
00234591|Ledce|Kladno|1|505
00572748|Stará Voda|Cheb|4|505
00581950|Vráto|České Budějovice|2|505
00266655|Žalany|Teplice|5|505
00568511|Březová|Zlín|12|504
00235351|Dolní Chvatliny|Kolín|1|504
00236802|Dřínov|Mělník|1|504
00234052|Záluží|Beroun|1|504
00237957|Jivina|Mladá Boleslav|1|503
00301752|Polkovice|Přerov|11|503
00296287|Razová|Bruntál|13|503
00292338|Studnice|Vyškov|10|503
00236632|Zbizuby|Kutná Hora|1|503
00272574|Česká Čermná|Náchod|7|502
00233714|Otročiněves|Beroun|1|502
00238431|Plazy|Mladá Boleslav|1|502
66144540|Nové Sedlice|Opava|13|501
00293318|Pavlice|Znojmo|10|501
00304212|Prlov|Vsetín|12|501
00255122|Velichov|Karlovy Vary|4|501
00283681|Velké Hostěrádky|Břeclav|10|501
00662283|Kozomín|Mělník|1|500
00600504|Litobratřice|Znojmo|10|500
00285340|Suchov|Hodonín|10|500
00274542|Veliny|Pardubice|8|500
00237949|Jabkenice|Mladá Boleslav|1|499
00302384|Bohuslavice|Šumperk|11|498
00282081|Mělčany|Brno - venkov|10|498
00266591|Srbice|Teplice|5|498
00234001|Všeradice|Beroun|1|498
00535931|Bocanovice|Frýdek - Místek|13|497
00287393|Kyselovice|Kroměříž|12|497
00510548|Liblice|Mělník|1|497
00832332|Pulečný|Jablonec nad Nisou|6|497
00252735|Radenín|Tábor|2|497
64679446|Těchlovice|Děčín|5|497
00635723|Haňovice|Olomouc|11|496
00291978|Kučerov|Vyškov|10|496
00256030|Rabí|Klatovy|3|496
00266205|Želenice|Most|5|496
00255483|Hlavňovice|Klatovy|3|495
00301345|Jindřichov|Přerov|11|495
00662887|Lhota u Příbramě|Příbram|1|495
00255777|Malý Bor|Klatovy|3|495
70810877|Mouřínov|Vyškov|10|495
00296333|Slezské Rudoltice|Bruntál|13|495
00572772|Zádub-Závišín|Cheb|4|495
00262625|Zlatá Olešnice|Jablonec nad Nisou|6|495
44684967|Karlík|Praha - západ|1|494
00635383|Radkov|Opava|13|494
00235385|Horní Kruty|Kolín|1|493
00283355|Milovice|Břeclav|10|493
00365548|Štěpánovice|Brno - venkov|10|493
00264610|Velké Žernoseky|Litoměřice|5|493
64629929|Bítov|Nový Jičín|13|492
00488534|Skoronice|Hodonín|10|492
00573892|Svojkovice|Rokycany|3|492
00271101|Úhřetice|Chrudim|8|492
00235393|Chotutice|Kolín|1|491
00508942|Dlouhá Lhota|Mladá Boleslav|1|491
00271951|Podhradí|Jičín|7|491
00233765|Rpety|Beroun|1|491
00477648|Srby|Domažlice|3|491
00233811|Stašov|Beroun|1|491
00237213|Střemy|Mělník|1|491
00257478|Ždírec|Plzeň - jih|3|491
00236853|Chlumín|Mělník|1|490
00289752|Lesonice|Třebíč|9|490
00290556|Šebkovice|Třebíč|9|489
00296449|Václavov u Bruntálu|Bruntál|13|489
00237388|Zlosyň|Mělník|1|489
00581321|Hlincová Hora|České Budějovice|2|488
00266108|Nová Ves v Horách|Most|5|488
00247227|Písečné|Jindřichův Hradec|2|488
00239178|Choťánky|Nymburk|1|487
00261327|Heřmanov|Děčín|5|487
00581909|Úsilné|České Budějovice|2|487
00572781|Valy|Cheb|4|487
00581925|Vitín|České Budějovice|2|487
00241091|Bojanovice|Praha - západ|1|486
00243728|Hořovičky|Rakovník|1|486
00640131|Popovičky|Praha - východ|1|486
48222623|Stožice|Strakonice|2|486
48333310|Žákava|Plzeň - jih|3|486
00269905|Bylany|Chrudim|8|485
00246468|Člunek|Jindřichův Hradec|2|485
00255408|Dlažov|Klatovy|3|485
00298824|Domašov nad Bystřicí|Olomouc|11|485
00302759|Kamenná|Šumperk|11|485
00667641|Libějovice|Strakonice|2|485
00286974|Zhoř|Jihlava|9|485
00252361|Choustník|Tábor|2|484
00303933|Kladeruby|Vsetín|12|484
00575640|Krčmaň|Olomouc|11|484
00543705|Hybrálec|Jihlava|9|483
00653560|Adršpach|Náchod|7|482
00246298|Blažejov|Jindřichův Hradec|2|482
00247065|Majdalena|Jindřichův Hradec|2|482
00275182|Olešnice|Rychnov nad Kněžnou|7|482
00556220|Trnovany|Litoměřice|5|482
00509001|Vlkava|Mladá Boleslav|1|482
00474177|Hlavenec|Praha - východ|1|481
00286672|Střítež|Jihlava|9|481
00272264|Úbislavice|Jičín|7|481
00242420|Klučenice|Příbram|1|480
00512699|Plavsko|Jindřichův Hradec|2|480
00543756|Smrčná|Jihlava|9|480
00232955|Vojkov|Benešov|1|480
00263389|Brňany|Litoměřice|5|479
00265934|Hora Svaté Kateřiny|Most|5|479
00250431|Hracholusky|Prachatice|2|479
00259969|Lesná|Tachov|3|479
00296198|Lomnice|Bruntál|13|479
00251704|Přešťovice|Strakonice|2|479
00832154|Stebno|Ústí nad Labem|5|479
00573621|Záchlumí|Tachov|3|479
00285811|Dušejov|Jihlava|9|478
00275221|Pěčín|Rychnov nad Kněžnou|7|478
00304336|Študlov|Zlín|12|478
00579459|Bělá nad Svitavou|Svitavy|8|477
00653616|Heřmánkovice|Náchod|7|477
00271152|Vítanov|Chrudim|8|477
00251097|Číčenice|Strakonice|2|476
00640255|Doubek|Praha - východ|1|476
00672009|Krásný Les|Liberec|6|476
00280402|Křetín|Blansko|10|476
00258261|Pňovany|Plzeň - sever|3|476
00272001|Radim|Jičín|7|476
00875899|Rybníky|Příbram|1|476
00579289|Synkov-Slemeno|Rychnov nad Kněžnou|7|476
00637335|Krasová|Blansko|10|475
00290254|Pyšel|Třebíč|9|475
00247499|Staré pod Landštejnem|Jindřichův Hradec|2|475
00572705|Třebeň|Cheb|4|475
00232424|Ostředek|Benešov|1|474
00635618|Ústín|Olomouc|11|474
00292699|Dolní Dubňany|Znojmo|10|473
00488852|Nenkovice|Hodonín|10|473
00270873|Řestoky|Chrudim|8|473
00579467|Biskupice|Svitavy|8|472
00273457|Čepí|Pardubice|8|472
00272558|Černčice|Náchod|7|472
00262790|Habartice|Liberec|6|472
00232076|Křivsoudov|Benešov|1|472
00279161|Lichkov|Ústí nad Orlicí|8|472
00831824|Líšťany|Louny|5|472
00673498|Hamr na Jezeře|Česká Lípa|6|471
00248398|Kejžlice|Pelhřimov|9|471
00600199|Klentnice|Břeclav|10|471
00247286|Popelín|Jindřichův Hradec|2|471
00281000|Suchý|Blansko|10|471
00269751|Vinary|Hradec Králové|7|471
00236594|Vlastějovice|Kutná Hora|1|471
00233188|Bzová|Beroun|1|470
00236055|Čestín|Kutná Hora|1|470
00253332|Draženov|Domažlice|3|470
48527416|Kožichovice|Třebíč|9|470
00261483|Kytlice|Děčín|5|470
00296180|Liptaň|Bruntál|13|470
00287431|Litenčice|Kroměříž|12|470
00568571|Hrobice|Zlín|12|469
00839591|Kozlov|Jihlava|9|469
00250503|Ktiš|Prachatice|2|469
00242802|Nedrahovice|Příbram|1|469
00636053|Uhelná|Jeseník|11|469
00532096|Bukovina|Blansko|10|468
00842494|Martinice|Žďár nad Sázavou|9|468
00288543|Ohrozim|Prostějov|11|468
00288853|Tištín|Prostějov|11|468
00274259|Slepotice|Pardubice|8|467
00263796|Klapý|Litoměřice|5|466
00637742|Lažany|Blansko|10|466
00841811|Němčice|Blansko|10|466
00233676|Olešná|Beroun|1|466
00232700|Soběhrdy|Benešov|1|466
00573027|Výrov|Plzeň - sever|3|466
00573221|Děpoltovice|Karlovy Vary|4|465
00288314|Ivaň|Prostějov|11|465
00287458|Lubná|Kroměříž|12|465
00477320|Peč|Jindřichův Hradec|2|465
00473766|Přistoupim|Kolín|1|465
00543730|Rantířov|Jihlava|9|465
00279510|Slatina|Ústí nad Orlicí|8|465
00841820|Sudice|Blansko|10|465
00545627|Třebenice|Třebíč|9|465
00473804|Dlouhá Lhota|Příbram|1|464
00244813|Doudleby|České Budějovice|2|464
00267597|Kámen|Havlíčkův Brod|9|464
00239534|Opočnice|Nymburk|1|464
00508373|Chlístov|Benešov|1|463
00302490|Dlouhomilov|Šumperk|11|463
46276068|Šanov|Zlín|12|463
00269671|Syrovátka|Hradec Králové|7|463
00255131|Verušičky|Karlovy Vary|4|463
00581372|Zahájí|České Budějovice|2|463
65269951|Kurdějov|Břeclav|10|462
00277002|Mladějov na Moravě|Svitavy|8|462
00295353|Řečice|Žďár nad Sázavou|9|462
00244121|Nesuchyně|Rakovník|1|461
00287563|Osíčko|Kroměříž|12|461
00264164|Ploskovice|Litoměřice|5|461
00525197|Prysk|Česká Lípa|6|461
00282626|Svatoslav|Brno - venkov|10|461
00599891|Ujčov|Žďár nad Sázavou|9|461
00842583|Vídeň|Žďár nad Sázavou|9|461
00265721|Výškov|Louny|5|461
00547905|Dřevnovice|Prostějov|11|460
00292940|Jiřice u Miroslavi|Znojmo|10|460
00289612|Kojetice|Třebíč|9|460
00266078|Mariánské Radčice|Most|5|460
00246018|Netřebice|Český Krumlov|2|460
00637483|Plaveč|Znojmo|10|460
00278378|Třebihošť|Trutnov|7|460
49750500|Hory|Karlovy Vary|4|459
00368709|Podomí|Vyškov|10|459
00260215|Svojšín|Tachov|3|459
00635260|Babice|Olomouc|11|458
00263524|Doksany|Litoměřice|5|458
00258440|Úlice|Plzeň - sever|3|458
00242012|Buková u Příbramě|Příbram|1|457
00243957|Krupá|Rakovník|1|457
00636568|Říkovice|Přerov|11|457
47884665|Újezd u Boskovic|Blansko|10|457
00841838|Valchov|Blansko|10|457
00258598|Žilov|Plzeň - sever|3|457
00259853|Hošťka|Tachov|3|456
00269174|Mžany|Hradec Králové|7|456
00287610|Podhradní Lhota|Kroměříž|12|456
00299758|Žerotín|Olomouc|11|456
00654744|Jeníkov|Chrudim|8|455
00362174|Medlovice|Uherské Hradiště|12|455
00485969|Čankovice|Chrudim|8|454
00289281|Dešov|Třebíč|9|454
00542369|Jankovice|Uherské Hradiště|12|454
00546739|Obyčtov|Žďár nad Sázavou|9|454
00241172|Dobříč|Praha - západ|1|453
00234338|Dřetovice|Kladno|1|453
00555932|Horní Habartice|Děčín|5|453
00509345|Kolomuty|Mladá Boleslav|1|453
00287865|Věžky|Kroměříž|12|453
00636045|Vlčice|Jeseník|11|453
00236004|Bohdaneč|Kutná Hora|1|452
00637521|Čučice|Brno - venkov|10|452
00278904|Horní Heřmanice|Ústí nad Orlicí|8|452
00292907|Jamolice|Znojmo|10|452
00636304|Křenovice|Přerov|11|452
00575950|Stará Ves|Bruntál|13|452
00270989|Studnice|Chrudim|8|452
00373567|Radslavice|Vyškov|10|451
00257681|Dolní Bělá|Plzeň - sever|3|450
00263583|Dušníky|Litoměřice|5|450
00234460|Jedomělice|Kladno|1|450
00234826|Pozdeň|Kladno|1|450
00671941|Proseč pod Ještědem|Liberec|6|450
00262129|Rokle|Chomutov|5|450
00288039|Bohuslavice|Prostějov|11|449
00557889|Drnovice|Zlín|12|449
00246751|Hospříz|Jindřichův Hradec|2|449
00244058|Městečko|Rakovník|1|449
00556360|Obora|Louny|5|449
00265314|Panenský Týnec|Louny|5|449
00673161|Račetice|Chomutov|5|449
00545031|Světnov|Žďár nad Sázavou|9|449
00287024|Bařice - Velké Těšany|Kroměříž|12|448
00572357|Kvíčovice|Plzeň - jih|3|448
00568660|Neubuz|Zlín|12|448
00581038|Horní Brusnice|Trutnov|7|447
00556424|Smolnice|Louny|5|447
00653331|Výrava|Hradec Králové|7|447
00636991|Rybníky|Znojmo|10|446
00277495|Trpín|Svitavy|8|446
00283118|Dobré Pole|Břeclav|10|445
00488496|Josefov|Hodonín|10|445
00287407|Lechotice|Kroměříž|12|445
00234729|Neuměřice|Kladno|1|445
00239623|Písty|Nymburk|1|445
00365408|Ponětovice|Brno - venkov|10|445
00374440|Vepřová|Žďár nad Sázavou|9|445
00237353|Zálezlice|Mělník|1|445
00273252|Zaloňov|Náchod|7|445
00572608|Brnířov|Domažlice|3|444
00876071|Chleby|Nymburk|1|444
00832022|Jiřetín pod Bukovou|Jablonec nad Nisou|6|444
00263940|Libotenice|Litoměřice|5|444
00846520|Oborná|Bruntál|13|444
00252751|Radimovice u Želče|Tábor|2|444
00288829|Stražisko|Prostějov|11|444
00265772|Žiželice|Louny|5|444
48679861|Josefův Důl|Mladá Boleslav|1|443
00266388|Kladruby|Teplice|5|443
00273783|Kojice|Pardubice|8|443
00296155|Leskovec nad Moravicí|Bruntál|13|443
00250619|Nová Pec|Prachatice|2|443
00671894|Svijanský Újezd|Liberec|6|443
00245747|Žabovřesky|České Budějovice|2|443
00239992|Žehuň|Kolín|1|443
00242071|Daleké Dušníky|Příbram|1|442
00302988|Maletín|Šumperk|11|442
00667820|Řepice|Strakonice|2|442
00264644|Vražkov|Litoměřice|5|442
00485667|Bítovany|Chrudim|8|441
00263419|Bříza|Litoměřice|5|441
00555975|Dobrná|Děčín|5|441
00667048|Myslkovice|Tábor|2|441
00275361|Semechnice|Rychnov nad Kněžnou|7|441
00259616|Stříbrná|Sokolov|4|441
00856606|Běstovice|Ústí nad Orlicí|8|440
00512940|Dolní Pěna|Jindřichův Hradec|2|440
00245887|Horní Dvořiště|Český Krumlov|2|440
00846511|Milotice nad Opavou|Bruntál|13|440
00266124|Patokryje|Most|5|440
00653420|Starý Bydžov|Hradec Králové|7|440
00253839|Újezd|Domažlice|3|440
00287008|Ždírec|Jihlava|9|440
00509329|Březina|Mladá Boleslav|1|439
00268739|Dohalice|Hradec Králové|7|439
00239356|Křečkov|Nymburk|1|439
00525049|Malá Veleň|Děčín|5|439
00525405|Polevsko|Česká Lípa|6|439
00232564|Přestavlky u Čerčan|Benešov|1|439
00274607|Vysoké Chvojno|Pardubice|8|439
00580571|Kunětice|Pardubice|8|438
00276031|Radostná pod Kozákovem|Semily|6|438
00636622|Teplice nad Bečvou|Přerov|11|438
00258466|Úterý|Plzeň - sever|3|438
00508985|Židněves|Mladá Boleslav|1|438
00267368|Dolní Krupá|Havlíčkův Brod|9|437
00512966|Domanín|Jindřichův Hradec|2|437
00654116|Jetřichov|Náchod|7|437
00262056|Okounov|Chomutov|5|437
00254860|Otročín|Karlovy Vary|4|437
00542270|Rudice|Uherské Hradiště|12|437
00277576|Vítějeves|Svitavy|8|437
00581003|Albrechtice|Ústí nad Orlicí|8|436
45978638|Blešno|Hradec Králové|7|436
00473227|Chýnice|Praha - západ|1|436
00579521|Horní Újezd|Svitavy|8|436
00287555|Nová Dědina|Kroměříž|12|436
00672912|Pertoltice pod Ralskem|Česká Lípa|6|436
00635316|Vilémov|Olomouc|11|436
00277584|Vranová Lhota|Svitavy|8|436
00270121|Horka|Chrudim|8|435
00302589|Hoštejn|Šumperk|11|435
00261971|Křimov|Chomutov|5|435
70871264|Lukoveček|Zlín|12|435
00301582|Milenov|Přerov|11|435
00265284|Nepomyšl|Louny|5|435
00258601|Úherce|Plzeň - sever|3|435
00509612|Bavoryně|Beroun|1|434
00273490|Dolany|Pardubice|8|434
00287156|Dřínov|Kroměříž|12|434
00579874|Knyk|Havlíčkův Brod|9|434
00273902|Lipoltice|Pardubice|8|434
00268119|Příseka|Havlíčkův Brod|9|434
00373591|Vážany|Vyškov|10|434
00237311|Všestudy|Mělník|1|434
00237477|Bítouchov|Mladá Boleslav|1|433
15054195|Klešice|Chrudim|8|433
00275921|Modřišice|Semily|6|433
00581861|Plav|České Budějovice|2|433
00636631|Tučín|Přerov|11|433
00242136|Drásov|Příbram|1|432
00579556|Javorník|Svitavy|8|432
00568601|Lutonina|Zlín|12|432
00239950|Vykáň|Nymburk|1|432
00246221|Zubčice|Český Krumlov|2|432
00542377|Košíky|Uherské Hradiště|12|431
00653608|Křinice|Náchod|7|431
00671991|Kryštofovo Údolí|Liberec|6|431
00509850|Velký Chlumec|Beroun|1|431
00270237|Jenišovice|Chrudim|8|430
00253537|Luženičky|Domažlice|3|430
00269484|Sendražice|Hradec Králové|7|430
00542318|Vážany|Uherské Hradiště|12|430
00232980|Vranov|Benešov|1|430
00267309|Dlouhá Ves|Havlíčkův Brod|9|429
00232017|Kozmice|Benešov|1|429
00289795|Lipník|Třebíč|9|429
00477311|Lužnice|Jindřichův Hradec|2|429
00241555|Pohoří|Praha - západ|1|429
00542229|Stříbrnice|Uherské Hradiště|12|429
00556475|Veltěže|Louny|5|429
00488518|Blatnička|Hodonín|10|428
00576875|Dolní Tošanovice|Frýdek - Místek|13|428
00255548|Hradešice|Klatovy|3|428
00276898|Květná|Svitavy|8|428
00269051|Lodín|Hradec Králové|7|428
00292133|Nemotice|Vyškov|10|428
00234851|Řisuty|Kladno|1|428
00472131|Zlatá|Praha - východ|1|428
00252263|Hlavatce|Tábor|2|427
00579564|Karle|Svitavy|8|427
00542415|Medlovice|Vyškov|10|427
00255840|Myslív|Klatovy|3|427
00236039|Černíny|Kutná Hora|1|426
00237906|Chocnějovice|Mladá Boleslav|1|426
00245143|Libín|České Budějovice|2|426
00568643|Loučka|Zlín|12|426
00236373|Rašovice|Kutná Hora|1|426
00636789|Říčky|Brno - venkov|10|426
00243361|Suchodol|Příbram|1|426
00233099|Zvěstov|Benešov|1|426
00289302|Dolní Vilémovice|Třebíč|9|425
00250406|Dub|Prachatice|2|425
00272647|Heřmanice|Náchod|7|425
00256609|Horšice|Plzeň - jih|3|425
00581411|Jivno|České Budějovice|2|425
00636002|Líšnice|Šumperk|11|425
00274313|Staré Jesenčany|Pardubice|8|425
00247529|Stříbřec|Jindřichův Hradec|2|425
00252166|Dírná|Tábor|2|424
00243710|Hořesedly|Rakovník|1|424
00636274|Horní Újezd|Přerov|11|424
00263826|Kostomlaty pod Řípem|Litoměřice|5|424
00508993|Lipník|Mladá Boleslav|1|424
00262048|Místo|Chomutov|5|424
00303437|Svébohov|Šumperk|11|424
00290602|Třebelovice|Třebíč|9|424
00568767|Vlčková|Zlín|12|424
00600148|Bavory|Břeclav|10|423
00270130|Horní Bradlo|Chrudim|8|423
00239411|Mcely|Nymburk|1|423
00635774|Valašská Senice|Vsetín|12|423
00238333|Nepřevázka|Mladá Boleslav|1|422
00292150|Nevojice|Vyškov|10|422
00583774|Střítež|Český Krumlov|2|422
00256315|Zavlekov|Klatovy|3|422
00261173|Arnoltice|Děčín|5|421
00519278|Josefov|Sokolov|4|421
00271691|Konecchlumí|Jičín|7|421
00378577|Římov|Třebíč|9|421
00637068|Tvořihráz|Znojmo|10|421
00257664|Dobříč|Plzeň - sever|3|420
00291927|Krásensko|Vyškov|10|420
00259977|Lestkov|Tachov|3|420
00841803|Lhota Rapotina|Blansko|10|420
00245216|Mladošovice|České Budějovice|2|420
70910740|Ostrata|Zlín|12|420
18243665|Příkosice|Rokycany|3|420
00270997|Svídnice|Chrudim|8|420
00287822|Troubky-Zdislavice|Kroměříž|12|420
00599174|Vícenice u Náměště nad Oslavou|Třebíč|9|420
00259667|Vřesová|Sokolov|4|420
00640671|Záhornice|Nymburk|1|420
00234133|Beřovice|Kladno|1|419
00242357|Jablonná|Příbram|1|419
00277487|Telecí|Svitavy|8|419
00249203|Těmice|Pelhřimov|9|419
00637653|Valtrovice|Znojmo|10|419
00273171|Velké Petrovice|Náchod|7|419
00268615|Běleč nad Orlicí|Hradec Králové|7|418
00581275|Dubičné|České Budějovice|2|418
00246123|Rožmitál na Šumavě|Český Krumlov|2|418
00254274|Trstěnice|Cheb|4|418
00281174|Úsobrno|Blansko|10|418
42634610|Vysoké Studnice|Jihlava|9|418
00556254|Blšany u Loun|Louny|5|417
00241962|Borotice|Příbram|1|417
00277711|Čermná|Trutnov|7|417
00637220|Habrůvka|Blansko|10|417
00636754|Jabloňany|Blansko|10|417
00287288|Jankovice|Kroměříž|12|417
00640212|Bratčice|Kutná Hora|1|416
00259381|Kaceřov|Sokolov|4|416
00663956|Kamenný Most|Kladno|1|416
00842567|Ruda|Žďár nad Sázavou|9|416
00362417|Salaš|Uherské Hradiště|12|416
00250732|Šumavské Hoštice|Prachatice|2|416
00236675|Žáky|Kutná Hora|1|416
00279951|Borotín|Blansko|10|415
00485063|Dřenice|Chrudim|8|415
00278084|Libňatov|Trutnov|7|415
00269239|Nové Město|Hradec Králové|7|415
00488330|Stanoviště|Brno - venkov|10|415
00235920|Vrbčany|Kolín|1|415
00237086|Nebužely|Mělník|1|414
00378470|Petrovice|Třebíč|9|414
00286516|Rohozná|Jihlava|9|414
00599999|Budětsko|Prostějov|11|413
00488437|Čeložnice|Hodonín|10|413
00251135|Drahonice|Strakonice|2|413
00635421|Uhlířov|Opava|13|413
00637351|Borotice|Znojmo|10|412
00236071|Horka II|Kutná Hora|1|412
00274470|Uhersko|Pardubice|8|412
00238953|Žerčice|Mladá Boleslav|1|412
00849529|Lužice|Olomouc|11|411
00274747|Borovnice|Rychnov nad Kněžnou|7|410
00488453|Hýsly|Hodonín|10|410
00232602|Radošovice|Benešov|1|410
00279498|Skořenice|Ústí nad Orlicí|8|410
00580911|Dolní Morava|Ústí nad Orlicí|8|409
00636312|Křtomil|Přerov|11|409
00636541|Rakov|Přerov|11|409
43750486|Veliká Ves|Praha - východ|1|409
00273422|Bukovka|Pardubice|8|408
00276561|Dětřichov|Svitavy|8|408
00640344|Horka I|Kutná Hora|1|408
00268852|Humburky|Hradec Králové|7|408
00238180|Ledce|Mladá Boleslav|1|408
00248665|Mnich|Pelhřimov|9|408
00577073|Pazderna|Frýdek - Místek|13|408
00266248|Bořislav|Teplice|5|407
00235512|Krupá|Kolín|1|407
00475491|Nová Ves|Český Krumlov|2|407
00525413|Račice|Litoměřice|5|407
00573159|Šabina|Sokolov|4|407
00235067|Uhy|Kladno|1|407
00637076|Velký Karlov|Znojmo|10|407
00274569|Veselí|Pardubice|8|407
00556491|Zbrašín|Louny|5|407
00259268|Bublava|Sokolov|4|406
00544175|Dobrá Voda|Žďár nad Sázavou|9|406
00854034|Hrušová|Ústí nad Orlicí|8|406
00273732|Jezbořice|Pardubice|8|406
00254894|Potůčky|Karlovy Vary|4|406
00250074|Ražice|Písek|2|406
00296341|Sosnová|Opava|13|405
00635987|Třeština|Šumperk|11|405
00555967|Valkeřice|Děčín|5|405
00238821|Velké Všelisy|Mladá Boleslav|1|405
00276286|Vyskeř|Semily|6|405
00600296|Dobřínsko|Znojmo|10|404
00236179|Krchleby|Kutná Hora|1|404
00667218|Ústrašice|Tábor|2|404
00532207|Vranová|Blansko|10|404
00276375|Benátky|Svitavy|8|403
00289655|Kouty|Třebíč|9|403
00378542|Rudka|Brno - venkov|10|403
00653683|Suchý Důl|Náchod|7|403
00253804|Tlumačov|Domažlice|3|403
00232971|Vracovice|Benešov|1|403
00573175|Andělská Hora|Karlovy Vary|4|402
00244724|Čejkovice|České Budějovice|2|402
00242152|Drevníky|Příbram|1|402
00555495|Homole u Panny|Ústí nad Labem|5|402
00640077|Močovice|Kutná Hora|1|402
00286401|Pavlov|Jihlava|9|402
00525511|Bedřichov|Jablonec nad Nisou|6|401
00555941|Františkov nad Ploučnicí|Děčín|5|401
00654752|Stolany|Chrudim|8|401
00667323|Zvěrotice|Tábor|2|401
00839582|Bítovčice|Jihlava|9|400
00573761|Dlouhý Újezd|Tachov|3|400
00473847|Kozárovice|Příbram|1|400
00654621|Předhradí|Chrudim|8|400
00362883|Březina|Brno - venkov|10|399
00233277|Hředle|Beroun|1|399
00236926|Kokořín|Mělník|1|399
00531677|Křižánky|Žďár nad Sázavou|9|399
00665169|Němčice|Kolín|1|399
00268372|Tis|Havlíčkův Brod|9|399
00653675|Bukovice|Náchod|7|398
00251241|Chelčice|Strakonice|2|398
00530468|Hradčany-Kobeřice|Prostějov|11|398
00268925|Klamoš|Hradec Králové|7|398
00368695|Kozlany|Vyškov|10|398
00288420|Lešany|Prostějov|11|398
00378194|Mladoňovice|Třebíč|9|398
00488259|Otmarov|Brno - venkov|10|398
00275328|Rybná nad Zdobnicí|Rychnov nad Kněžnou|7|398
00295931|Dětřichov nad Bystřicí|Bruntál|13|397
00271624|Jeřice|Jičín|7|397
00276871|Křenov|Svitavy|8|397
00243001|Pečice|Příbram|1|397
00268569|Žižkovo Pole|Havlíčkův Brod|9|397
00258636|Březina|Rokycany|3|396
00239003|Bříství|Nymburk|1|396
00572543|Chodská Lhota|Domažlice|3|396
00292842|Hostim|Znojmo|10|396
00268950|Králíky|Hradec Králové|7|396
00298158|Luboměř|Nový Jičín|13|396
00640191|Horky|Kutná Hora|1|395
00261394|Jetřichovice|Děčín|5|395
00544701|Kuželov|Hodonín|10|395
00640735|Lichoceves|Praha - západ|1|395
00636916|Plenkovice|Znojmo|10|395
00234834|Přelíc|Kladno|1|395
00287741|Soběsuky|Kroměříž|12|395
00637700|Svinošice|Blansko|10|395
00640204|Drobovice|Kutná Hora|1|394
00249769|Kostelec nad Vltavou|Písek|2|394
00378135|Lukov|Třebíč|9|394
00253731|Srbice|Domažlice|3|394
00842575|Uhřínov|Žďár nad Sázavou|9|394
00275174|Olešnice v Orlických horách|Rychnov nad Kněžnou|7|393
00238619|Skalsko|Mladá Boleslav|1|393
00573256|Krásné Údolí|Karlovy Vary|4|392
00254096|Mnichov|Cheb|4|392
00270865|Řepníky|Ústí nad Orlicí|8|392
00250694|Strážný|Prachatice|2|392
00271161|Vojtěchov|Chrudim|8|392
00242063|Čím|Příbram|1|391
00237701|Dolní Slivno|Mladá Boleslav|1|391
00556301|Hříškov|Louny|5|391
00245020|Jankov|České Budějovice|2|391
00239224|Jizbice|Nymburk|1|391
00579271|OBEC HŘIBINY-LEDSKÁ|Rychnov nad Kněžnou|7|391
00279331|Pastviny|Ústí nad Orlicí|8|391
00274682|Bačetín|Rychnov nad Kněžnou|7|390
00287091|Brusné|Kroměříž|12|390
00242268|Hřiměždice|Příbram|1|390
00372480|Ježkovice|Vyškov|10|390
00248363|Kaliště|Pelhřimov|9|390
00654728|Kostelec u Heřmanova Městce|Chrudim|8|390
00240443|Máslovice|Praha - východ|1|390
00508969|Sukorady|Mladá Boleslav|1|390
00600105|Zdětín|Prostějov|11|390
00849707|Čermná ve Slezsku|Opava|13|389
00240265|Kaliště|Praha - východ|1|389
00235598|Nučice|Praha - východ|1|389
00378593|Senorady|Brno - venkov|10|389
00277461|Široký Důl|Svitavy|8|389
00365726|Trboušany|Brno - venkov|10|389
00281344|Žďár|Blansko|10|389
00526479|Židovice|Litoměřice|5|389
00572551|Babylon|Domažlice|3|388
00580759|Doubravice|Trutnov|7|388
00477001|Dvory nad Lužnicí|Jindřichův Hradec|2|388
00405493|Kupařovice|Brno - venkov|10|388
00568678|Oldřichovice|Zlín|12|388
00269263|Olešnice|Hradec Králové|7|388
00636461|Paršovice|Přerov|11|388
00272981|Rožnov|Náchod|7|388
00376833|Heraltice|Třebíč|9|387
00268976|Kunčice|Hradec Králové|7|387
00555908|Veselé|Děčín|5|387
00274593|Voleč|Pardubice|8|387
00263443|Ctiněves|Litoměřice|5|386
00636011|Hradec-Nová Ves|Jeseník|11|386
00672017|Kobyly|Liberec|6|386
00671967|Paceřice|Liberec|6|386
00256072|Soběšice|Klatovy|3|386
00257427|Vrčeň|Plzeň - jih|3|386
00476838|Bezdědovice|Strakonice|2|385
00238244|Loukovec|Mladá Boleslav|1|385
00288454|Malé Hradisko|Prostějov|11|385
00234711|Malíkovice|Kladno|1|385
00574198|Nebílovy|Plzeň - jih|3|385
00293326|Petrovice|Znojmo|10|385
00380873|Vítonice|Kroměříž|12|385
00272515|Božanov|Náchod|7|383
00640549|Libovice|Kladno|1|383
00636851|Mackovice|Znojmo|10|383
00544604|Němčice|Kroměříž|12|383
00488461|Terezín|Hodonín|10|383
00278602|Cotkytle|Ústí nad Orlicí|8|382
00535974|Horní Lomná|Frýdek - Místek|13|382
00232220|Mezno|Benešov|1|382
00368784|Topolany|Vyškov|10|382
00360392|Částkov|Uherské Hradiště|12|381
00264113|Nové Dvory|Litoměřice|5|381
00244198|Oráčov|Rakovník|1|381
00295876|Bohušov|Bruntál|13|380
00509116|Charvatce|Mladá Boleslav|1|380
00263494|Děčany|Litoměřice|5|380
00244864|Dynín|České Budějovice|2|380
00576026|Mezina|Bruntál|13|380
00665657|Soběnov|Český Krumlov|2|380
00302457|Bušín|Šumperk|11|379
00242055|Čenkov|Příbram|1|379
00600270|Damnice|Znojmo|10|379
00250350|Bošice|Prachatice|2|378
00278645|Česká Rybná|Ústí nad Orlicí|8|378
00572586|Díly|Domažlice|3|378
00373664|Dlouhá Brtnice|Jihlava|9|378
00245224|Nedabyle|České Budějovice|2|378
00232475|Petroupim|Benešov|1|378
00639737|Radovesnice I|Kolín|1|378
00640697|Velenka|Nymburk|1|378
00526436|Keblice|Litoměřice|5|377
00269646|Střezetice|Hradec Králové|7|377
00295833|Žďárec|Brno - venkov|10|377
60153415|Dolní Brusnice|Trutnov|7|376
00599611|Netín|Žďár nad Sázavou|9|376
00267988|Olešná|Havlíčkův Brod|9|376
00292478|Běhařovice|Znojmo|10|375
00253286|Černíkov|Klatovy|3|375
00280101|Černovice|Blansko|10|375
00636444|Oplocany|Přerov|11|375
00234818|Podlešín|Kladno|1|375
00270814|Raná|Chrudim|8|375
00246115|Rožmberk nad Vltavou|Český Krumlov|2|375
00375403|Blatnice|Třebíč|9|374
00235318|Černé Voděrady|Praha - východ|1|374
00583022|Chlumany|Prachatice|2|374
00876267|Horní Slivno|Mladá Boleslav|1|374
00251283|Kadov|Strakonice|2|374
00494267|Kaňovice|Frýdek - Místek|13|374
00637262|Kořenec|Blansko|10|374
00279196|Lubník|Ústí nad Orlicí|8|374
00662259|Nedomice|Mělník|1|374
48679836|Rokytá|Mladá Boleslav|1|374
00544680|Stavěšice|Hodonín|10|374
00235784|Toušice|Kolín|1|374
00273198|Vlkov|Náchod|7|374
00243515|Volenice|Příbram|1|374
00271195|Vrbatův Kostelec|Chrudim|8|374
00636134|Býškovice|Přerov|11|373
00580961|Džbánov|Ústí nad Orlicí|8|373
00580783|Horní Kalná|Trutnov|7|373
00653357|Neděliště|Hradec Králové|7|373
00488267|Popovice|Brno - venkov|10|373
00636151|Buk|Přerov|11|372
00580171|Dolní Olešnice|Trutnov|7|372
00257273|Střížovice|Plzeň - jih|3|372
00579483|Desná|Svitavy|8|371
00249963|Ostrovec|Písek|2|371
00636932|Pravice|Znojmo|10|371
00252140|Budislav|Tábor|2|370
00241270|Choteč|Praha - západ|1|370
00572641|Chrastavice|Domažlice|3|370
42660564|Kojátky|Vyškov|10|370
00526134|Lukavec|Litoměřice|5|370
00556394|Pnětluky|Louny|5|370
00250112|Slabčice|Písek|2|370
00473791|Ždánice|Kolín|1|370
00580210|Borovnice|Trutnov|7|369
00235563|Malotice|Kolín|1|369
00671908|Svijany|Liberec|6|369
00491845|Košařiska|Frýdek - Místek|13|368
00580775|Suchovršice|Trutnov|7|368
00494259|Žermanice|Frýdek - Místek|13|368
70599971|Kobylá nad Vidnavkou|Jeseník|11|367
00842648|Křídla|Žďár nad Sázavou|9|367
00509728|Lhotka|Beroun|1|367
00581801|Neplachov|České Budějovice|2|367
00600202|Nový Přerov|Břeclav|10|367
00295957|Dolní Moravice|Bruntál|13|366
00662801|Dubenec|Příbram|1|366
00662810|Dubno|Příbram|1|366
00279056|Koldín|Ústí nad Orlicí|8|366
00581437|Komařice|České Budějovice|2|366
00280712|Obora|Blansko|10|366
00475777|Srnín|Český Krumlov|2|366
00245691|Záboří|České Budějovice|2|366
00573051|Čeminy|Plzeň - sever|3|365
00258709|Hlohovice|Rokycany|3|365
00480002|Horní Blatná|Karlovy Vary|4|365
46276084|Lipová|Zlín|12|365
00253693|Puclice|Domažlice|3|365
00269697|Těchlovice|Hradec Králové|7|365
00260274|Třemešné|Tachov|3|365
00568546|Držková|Zlín|12|364
00573604|Týnec|Klatovy|3|364
00278459|Vlčkovice v Podkrkonoší|Trutnov|7|364
00271420|Bystřice|Jičín|7|363
47922311|Dobrochov|Prostějov|11|363
00267996|Oudoleň|Havlíčkův Brod|9|363
00488909|Skaštice|Kroměříž|12|363
00368652|Milonice|Vyškov|10|362
00272892|Nový Ples|Náchod|7|362
00556378|Očihov|Louny|5|362
00853984|Přívrat|Ústí nad Orlicí|8|362
00244465|Svojetín|Rakovník|1|362
00526126|Lhotka nad Labem|Litoměřice|5|361
00250007|Podolí I|Písek|2|361
00272345|Vidochov|Jičín|7|361
00243574|Vysoká u Příbramě|Příbram|1|361
00250864|Zbytiny|Prachatice|2|361
00259306|Dolní Nivy|Sokolov|4|360
00261866|Hora Svatého Šebestiána|Chomutov|5|360
00509248|Jizerní Vtelno|Mladá Boleslav|1|360
00572730|Pomezí nad Ohří|Cheb|4|360
00276260|Vítkovice|Semily|6|360
00600750|Heřmanice u Oder|Nový Jičín|13|359
00636371|Malhotice|Přerov|11|359
00257052|Nové Mitrovice|Plzeň - jih|3|359
00295167|Prosetín|Žďár nad Sázavou|9|359
00575984|Rudná pod Pradědem|Bruntál|13|359
00293709|Uherčice|Znojmo|10|359
00287237|Chomýž|Kroměříž|12|358
00239291|Košík|Nymburk|1|358
00234869|Sazená|Kladno|1|358
00272299|Újezd pod Troskami|Jičín|7|358
00575976|Andělská Hora|Bruntál|13|357
00279986|Brťov - Jeneč|Blansko|10|357
00273651|Choteč|Pardubice|8|357
00600351|Hnanice|Znojmo|10|357
00276812|Kamenná Horka|Svitavy|8|357
00635324|Senička|Olomouc|11|357
00252913|Smilovy Hory|Tábor|2|357
00243311|Solenice|Příbram|1|357
00488500|Syrovín|Hodonín|10|357
00289167|Budkov|Třebíč|9|356
00663948|Hobšovice|Kladno|1|356
00377007|Javůrek|Brno - venkov|10|356
00236306|Onomyšl|Kutná Hora|1|356
00238414|Petkovy|Mladá Boleslav|1|356
00274364|Strašov|Pardubice|8|356
00640778|Zahořany|Praha - západ|1|356
42717205|Březovice|Mladá Boleslav|1|355
00853151|Drozdov|Šumperk|11|355
00239216|Jíkev|Nymburk|1|355
00296121|Krasov|Bruntál|13|355
47884550|Ludíkov|Blansko|10|355
00256927|Mileč|Plzeň - jih|3|355
00573264|Mírová|Karlovy Vary|4|355
00269158|Mokrovousy|Hradec Králové|7|355
00294977|Olší|Brno - venkov|10|355
00671932|Radimovice|Liberec|6|355
00277452|Svojanov|Svitavy|8|355
00671878|Vlastibořice|Liberec|6|355
00635286|Domašov u Šternberka|Olomouc|11|354
00250422|Horní Vltavice|Prachatice|2|354
00362948|Hvozdec|Brno - venkov|10|354
00244619|Zavidov|Rakovník|1|354
00581224|Dasný|České Budějovice|2|353
00511315|Kojčice|Pelhřimov|9|353
00580741|Lampertice|Trutnov|7|353
00583090|Mičovice|Prachatice|2|353
00635995|Mírov|Šumperk|11|353
00473880|Příčovy|Příbram|1|353
00253006|Šebířov|Tábor|2|353
00508934|Sovínky|Mladá Boleslav|1|353
00579653|Útěchov|Svitavy|8|353
00262218|Vrskmaň|Chomutov|5|353
00484164|Bělá u Jevíčka|Svitavy|8|352
00285676|Brzkov|Jihlava|9|352
00573779|Částkov|Tachov|3|352
00572888|Krašovice|Plzeň - sever|3|352
00378216|Nárameč|Třebíč|9|352
00666475|Nová Ves nad Lužnicí|Jindřichův Hradec|2|352
00269387|Převýšov|Hradec Králové|7|352
00232921|Veliš|Benešov|1|352
00261815|Boleboř|Chomutov|5|351
00556335|Libořice|Louny|5|351
00294730|Lísek|Žďár nad Sázavou|9|351
00243400|Štětkovice|Příbram|1|351
00673382|Bezděz|Česká Lípa|6|350
70910731|Bohuslavice nad Vláří|Zlín|12|350
00842460|Jabloňov|Žďár nad Sázavou|9|350
00273694|Jankovice|Pardubice|8|350
00270369|Leština|Ústí nad Orlicí|8|350
00574147|Oplot|Plzeň - jih|3|350
00545775|Ořechov|Žďár nad Sázavou|9|350
00544418|Pavlov|Žďár nad Sázavou|9|350
00271047|Tisovec|Chrudim|8|350
00235849|Uhlířská Lhota|Kolín|1|350
00104051|Žerotice|Znojmo|10|350
00294021|Borač|Brno - venkov|10|349
00251798|Sousedovice|Strakonice|2|349
00239909|Vestec|Nymburk|1|349
00637211|Vilémovice|Blansko|10|349
00872083|Vysoká Pec|Karlovy Vary|4|349
00267295|Číhošť|Havlíčkův Brod|9|348
00259811|Erpužice|Tachov|3|348
00271870|Nemyčeves|Jičín|7|348
00673412|Okna|Česká Lípa|6|348
00653462|Světí|Hradec Králové|7|348
00249556|Božetice|Písek|2|347
00288331|Kladky|Prostějov|11|347
00637432|Miroslavské Knínice|Znojmo|10|347
00479080|Nové Hamry|Karlovy Vary|4|347
00639711|Pašinka|Kolín|1|347
00257362|Ves Touškov|Plzeň - jih|3|347
00376779|Čechočovice|Třebíč|9|346
00635944|Horní Studénky|Šumperk|11|346
00296082|Jiříkov|Bruntál|13|346
00275034|Ledce|Hradec Králové|7|346
00636347|Lhota|Přerov|11|346
00275042|Lhoty u Potštejna|Rychnov nad Kněžnou|7|346
00269255|Ohnišťany|Hradec Králové|7|346
48471640|Tichov|Zlín|12|346
00250856|Zálezly|Prachatice|2|346
00581976|Žár|České Budějovice|2|346
00666378|Hamr|Jindřichův Hradec|2|345
00249734|Jetětice|Písek|2|345
00510564|Konětopy|Praha - východ|1|345
00268933|Kosice|Hradec Králové|7|345
00872067|Krásný Les|Karlovy Vary|4|345
00288578|Ondratice|Prostějov|11|345
00257061|Oselce|Plzeň - jih|3|345
00252719|Přehořov|Tábor|2|345
00257460|Zemětice|Plzeň - jih|3|345
00262277|Albrechtice v Jizerských horách|Jablonec nad Nisou|6|344
00231606|Červený Újezd|Benešov|1|344
46744967|Kunratice|Liberec|6|344
00276961|Makov|Svitavy|8|344
00303127|Palonín|Šumperk|11|344
00259560|Rovná|Sokolov|4|344
00272248|Třtěnice|Jičín|7|344
00583162|Žernovice|Prachatice|2|344
00231819|Hvězdonice|Benešov|1|343
00481670|Jenčice|Litoměřice|5|343
00488054|Němčičky|Brno - venkov|10|343
00378691|Sudice|Třebíč|9|343
00279668|Újezd u Chocně|Ústí nad Orlicí|8|343
00556467|Velemyšleves|Louny|5|343
00476447|Horní Ves|Pelhřimov|9|342
00636282|Hradčany|Přerov|11|342
00581429|Kamenná|České Budějovice|2|342
00574309|Mokrouše|Plzeň - město|3|342
00258130|Mrtník|Plzeň - sever|3|342
00488445|Nechvalín|Hodonín|10|342
70890587|Šelešovice|Kroměříž|12|342
00375276|Šerkovice|Brno - venkov|10|342
00508501|Tehov|Benešov|1|342
00274488|Úhřetická Lhota|Pardubice|8|342
00599271|Blízkov|Žďár nad Sázavou|9|341
00545422|Radňovice|Žďár nad Sázavou|9|341
00273317|Barchov|Pardubice|8|340
00233153|Březová|Beroun|1|340
00242021|Buš|Praha - západ|1|340
00575992|Čaková|Bruntál|13|340
00279013|Kameničná|Ústí nad Orlicí|8|340
00268941|Kosičky|Hradec Králové|7|340
60104171|Mrákotín|Chrudim|8|340
00252018|Záboří|Strakonice|2|340
00556009|Bynovec|Děčín|5|339
00849499|Horní Loděnice|Olomouc|11|339
00667137|Řípec|Tábor|2|339
00301299|Hrabůvka|Přerov|11|338
00270164|Hroubovice|Chrudim|8|338
00556025|Janov|Děčín|5|338
00251623|Novosedly|Strakonice|2|338
00653471|Obědovice|Hradec Králové|7|338
00373575|Snovídky|Vyškov|10|338
00288241|Hluchov|Prostějov|11|337
00576085|Horní Životice|Bruntál|13|337
00255912|Nezdice na Šumavě|Klatovy|3|337
00846538|Nové Heřminovy|Bruntál|13|337
00578631|Úlibice|Jičín|7|337
00268437|Vepříkov|Havlíčkův Brod|9|337
00573400|Vřeskovice|Klatovy|3|337
00302341|Bílá Voda|Jeseník|11|336
00236713|Borek|Praha - východ|1|336
00295981|Heřmanovice|Bruntál|13|336
00249955|Oslov|Písek|2|336
00581259|Doubravice|České Budějovice|2|335
00234346|Dřínov|Kladno|1|335
00473821|Kňovice|Příbram|1|335
00580619|Stéblová|Pardubice|8|335
00368687|Zlámanec|Uherské Hradiště|12|335
00509621|Běštín|Beroun|1|334
00273325|Bezděkov|Pardubice|8|334
00581267|Drahotěšice|České Budějovice|2|334
00662291|Hostín u Vojkovic|Mělník|1|334
00279005|Jehnědí|Ústí nad Orlicí|8|334
00640662|Kouty|Nymburk|1|334
00295043|Otín|Žďár nad Sázavou|9|334
00667188|Sviny|Tábor|2|334
00247901|Budíkov|Pelhřimov|9|333
00662399|Dobročovice|Praha - východ|1|333
00599671|Pikárec|Žďár nad Sázavou|9|333
00573043|Příšov|Plzeň - sever|3|333
00290297|Radkovice u Hrotovic|Třebíč|9|333
00488658|Růžená|Jihlava|9|333
00273180|Velký Třebešov|Náchod|7|333
00636177|Čechy|Přerov|11|332
00241130|Číčovice|Praha - západ|1|332
00854662|Levínská Olešnice|Semily|6|332
00662275|Lhotka|Mělník|1|332
00271781|Lukavec u Hořic|Jičín|7|332
00637505|Nesvačilka|Brno - venkov|10|332
00600083|Skřípov|Prostějov|11|332
00579181|Tutleky|Rychnov nad Kněžnou|7|332
00842184|Věchnov|Žďár nad Sázavou|9|332
00272361|Vitiněves|Jičín|7|332
00253103|Vlastiboř|Tábor|2|332
00279731|Voděrady|Ústí nad Orlicí|8|332
00272086|Sběř|Jičín|7|331
00239861|Úmyslovice|Nymburk|1|331
00243558|Vranovice|Příbram|1|331
00580457|Dubany|Pardubice|8|330
00263842|Křesín|Litoměřice|5|330
00242721|Milešov|Příbram|1|330
00270521|Mladoňovice|Chrudim|8|330
00667170|Sudoměřice u Tábora|Tábor|2|330
00509337|Dolní Stakory|Mladá Boleslav|1|329
00246794|Hříšice|Jindřichův Hradec|2|329
45978662|Hvozdnice|Hradec Králové|7|329
00235555|Lošany|Kolín|1|329
00288519|Niva|Prostějov|11|329
00251160|Dřešín|Strakonice|2|328
00842231|Nové Dvory|Žďár nad Sázavou|9|328
00473758|Přehvozdí|Kolín|1|328
00262188|Veliká Ves|Chomutov|5|328
00243604|Zalužany|Příbram|1|328
00373605|Zelená Hora|Vyškov|10|328
00526428|Černouček|Litoměřice|5|327
00248487|Křelovice|Pelhřimov|9|327
00260738|Mařenice|Česká Lípa|6|327
00233692|Osov|Beroun|1|327
00272914|Otovice|Náchod|7|327
00579262|Třebešov|Rychnov nad Kněžnou|7|327
00274585|Vlčí Habřina|Pardubice|8|327
00483087|Břvany|Louny|5|326
00294284|Fryšava pod Žákovou horou|Žďár nad Sázavou|9|326
00258903|Mlečice|Rokycany|3|326
00496979|Rozhovice|Chrudim|8|326
00637581|Stošíkovice na Louce|Znojmo|10|326
00255114|Valeč|Karlovy Vary|4|326
00239186|Chotěšice|Nymburk|1|325
00254118|Nebanice|Cheb|4|325
00373508|Nemochovice|Vyškov|10|325
00252603|Nová Ves u Chýnova|Tábor|2|325
00235601|Ohaře|Kolín|1|325
00578525|Rohoznice|Jičín|7|325
00257192|Seč|Plzeň - jih|3|325
00524751|Stvolínky|Česká Lípa|6|325
00274445|Turkovice|Pardubice|8|325
00276472|Březina|Svitavy|8|324
00868841|Ctiboř|Tachov|3|324
00236985|Křenek|Praha - východ|1|324
00509779|Nenačovice|Beroun|1|324
00378267|Ocmanice|Třebíč|9|324
00666548|Třebětice|Jindřichův Hradec|2|324
00511692|Zbelítov|Písek|2|324
00636169|Císařov|Přerov|11|323
00170551|Údrnice|Jičín|7|323
00296465|Vysoká|Bruntál|13|323
00287032|Bělov|Zlín|12|322
00240397|Křížkový Újezdec|Praha - východ|1|322
00544493|Podkopná Lhota|Zlín|12|322
00251682|Pracejovice|Strakonice|2|322
00268186|Sázavka|Havlíčkův Brod|9|322
00640743|Svrkyně|Praha - západ|1|322
00654124|Vernéřovice|Náchod|7|322
00273295|Žernov|Náchod|7|322
00241971|Bratkovice|Příbram|1|321
00249653|Heřmaň|Písek|2|321
00302813|Kosov|Šumperk|11|321
00304395|Valašské Příkazy|Zlín|12|321
00250333|Bohumilice|Prachatice|2|320
00573817|Lhota pod Radčem|Rokycany|3|320
00578444|Milovice u Hořic|Jičín|7|320
00636967|Rešice|Znojmo|10|320
00268232|Skuhrov|Havlíčkův Brod|9|320
00259136|Těškov|Rokycany|3|320
00250741|Těšovice|Prachatice|2|320
00259195|Veselá|Rokycany|3|320
00250210|Vráž|Písek|2|320
00875121|Železná|Beroun|1|320
00636142|Bohuslávky|Přerov|11|319
00235539|Libenice|Kolín|1|319
00235547|Libodřice|Kolín|1|319
00572659|Mířkov|Domažlice|3|319
00667064|Nemyšl|Tábor|2|319
00473481|Ratměřice|Benešov|1|319
00286605|Sedlejov|Jihlava|9|319
00235253|Bělušice|Kolín|1|318
48931250|Kostomlátky|Nymburk|1|318
00304085|Malá Bystřice|Vsetín|12|318
00509183|Ptýrov|Mladá Boleslav|1|318
00250104|Skály|Písek|2|318
00244449|Srbeč|Rakovník|1|318
00526061|Vrutice|Litoměřice|5|318
00250287|Zhoř|Písek|2|318
00288021|Biskupice|Prostějov|11|317
00582981|Buk|Prachatice|2|317
00259331|Chlum Svaté Maří|Sokolov|4|317
00876089|Jiřice|Nymburk|1|317
00290149|Police|Třebíč|9|317
00256099|Strašín|Klatovy|3|317
00528986|Urbanice|Hradec Králové|7|317
00576018|Velká Štáhle|Bruntál|13|317
00234451|Jarpice|Kladno|1|316
00273848|Labské Chrčice|Pardubice|8|316
00250520|Lažiště|Prachatice|2|316
00254070|Milhostov|Cheb|4|316
00244066|Milostín|Rakovník|1|316
00373460|Mouchnice|Hodonín|10|316
68731957|Petrůvka|Zlín|12|316
00268241|Slavíkov|Havlíčkův Brod|9|316
00273058|Slavoňov|Náchod|7|316
00473910|Zduchovice|Příbram|1|316
00235270|Břežany I.|Kolín|1|315
00289311|Domamil|Třebíč|9|315
00268755|Habřina|Hradec Králové|7|315
00488135|Hlína|Brno - venkov|10|315
00288667|Prostějovičky|Prostějov|11|315
00498611|Rohozec|Kutná Hora|1|315
00251879|Škvořetice|Strakonice|2|315
00636606|Sušice|Přerov|11|315
00543772|Vílanec|Jihlava|9|315
00544515|Jarohněvice|Kroměříž|12|314
00568619|Lhotsko|Zlín|12|314
00266477|Měrunice|Teplice|5|314
00239518|Odřepsy|Nymburk|1|314
00653373|Sadová|Hradec Králové|7|314
00828807|Vrbičany|Litoměřice|5|314
00576115|Dívčí Hrad|Bruntál|13|313
00568597|Komárov|Zlín|12|313
00273023|Slatina nad Úpou|Náchod|7|313
00554847|Vchynice|Litoměřice|5|313
00244601|Všetaty|Rakovník|1|313
00250848|Záblatí|Prachatice|2|313
00289205|Čechtín|Třebíč|9|312
00672084|Černousy|Liberec|6|312
00285757|Dobroutov|Jihlava|9|312
00599395|Horní Loučky|Brno - venkov|10|312
00672904|Noviny pod Ralskem|Česká Lípa|6|312
00274062|Poběžovice u Holic|Pardubice|8|312
00579246|Rohenice|Rychnov nad Kněžnou|7|312
00287890|Zahnašovice|Kroměříž|12|312
00376850|Hodov|Třebíč|9|311
00543942|Kaly|Brno - venkov|10|311
00580554|Křičeň|Pardubice|8|311
00270598|Nové Hrady|Ústí nad Orlicí|8|311
00236349|Petrovice I|Kutná Hora|1|311
00277231|Pustá Kamenice|Svitavy|8|311
00573850|Smědčice|Rokycany|3|311
00637602|Šumice|Brno - venkov|10|311
00640298|Třebešice|Kutná Hora|1|311
00263869|Kyškovice|Litoměřice|5|310
00636398|Milotice nad Bečvou|Přerov|11|310
00251593|Nihošovice|Strakonice|2|310
00509426|Niměřice|Mladá Boleslav|1|310
00581836|Petříkov|České Budějovice|2|310
00269638|Stračov|Hradec Králové|7|310
00234443|Chržín|Kladno|1|309
00274267|Sopřeč|Pardubice|8|309
00238678|Strašnov|Mladá Boleslav|1|309
00281018|Sulíkov|Blansko|10|309
00251933|Třebohostice|Strakonice|2|309
00637165|Želetice|Znojmo|10|309
00249564|Branice|Písek|2|308
00545899|Černá|Žďár nad Sázavou|9|308
00573205|Černava|Karlovy Vary|4|308
00665665|Mojné|Český Krumlov|2|308
00635791|Podolí|Vsetín|12|308
00578584|Staré Místo|Jičín|7|308
00277886|Horní Olešnice|Trutnov|7|307
00477133|Horní Poříčí|Strakonice|2|307
00510556|Hostín|Mělník|1|307
00277282|Rozhraní|Svitavy|8|307
00378623|Smrk|Třebíč|9|307
00232777|Střezimíř|Benešov|1|307
00640263|Běleč|Kladno|1|306
00272582|Česká Metuje|Náchod|7|306
00247936|Cetoraz|Pelhřimov|9|306
00283134|Dolní Věstonice|Břeclav|10|306
00600342|Havraníky|Znojmo|10|306
00378704|Štěměchy|Třebíč|9|306
00667234|Vesce|Tábor|2|306
00640689|Zvěřínek|Nymburk|1|306
00653322|Libřice|Hradec Králové|7|305
00277151|Pohledy|Svitavy|8|305
00572861|Rochlov|Plzeň - sever|3|305
00266141|Skršín|Most|5|305
00279692|Velká Skrovnice|Ústí nad Orlicí|8|305
47786701|Čeradice|Louny|5|304
00234532|Kmetiněves|Kladno|1|304
00278017|Kohoutov|Trutnov|7|304
00477028|Kostelní Radouň|Jindřichův Hradec|2|304
00373541|Orlovice|Vyškov|10|304
00842362|Vatín|Žďár nad Sázavou|9|304
00581216|Čakov|České Budějovice|2|303
00237728|Domousnice|Mladá Boleslav|1|303
00226238|Kaňovice|Zlín|12|303
00574023|Kotovice|Plzeň - jih|3|303
00233579|Měňany|Beroun|1|303
00850675|Polom|Přerov|11|303
00275484|Val|Rychnov nad Kněžnou|7|303
00242161|Drhovy|Příbram|1|302
00233226|Felbabka|Beroun|1|302
00234478|Jemníky|Kladno|1|302
00288357|Klopotovice|Prostějov|11|302
00508918|Nová Ves u Bakova|Mladá Boleslav|1|302
00671959|Pertoltice|Liberec|6|302
00273112|Šonov|Náchod|7|302
00259128|Těně|Rokycany|3|302
00576930|Vělopolí|Frýdek - Místek|13|302
00377295|Chlístov|Třebíč|9|301
00579238|Jílovice|Hradec Králové|7|301
00581780|Mydlovary|České Budějovice|2|301
00242942|Ohrazenice|Příbram|1|301
00249939|Orlík nad Vltavou|Písek|2|301
00265373|Počedělice|Louny|5|301
00580058|Sedletín|Havlíčkův Brod|9|301
00485535|Krasíkov|Ústí nad Orlicí|8|300
00368768|Lysovice|Vyškov|10|300
00667684|Mačkov|Strakonice|2|300
00573591|Poleň|Klatovy|3|300
00635961|Postřelmůvek|Šumperk|11|300
00378607|Slavičky|Třebíč|9|300
00484768|Lány|Chrudim|8|299
00635405|Mikolajice|Opava|13|299
00574287|Nová Ves|Plzeň - jih|3|299
00842559|Petráveč|Žďár nad Sázavou|9|299
00269310|Písek|Hradec Králové|7|299
00508411|Popovice|Benešov|1|299
00573337|Svéradice|Klatovy|3|299
00277550|Vidlatá Seč|Svitavy|8|299
00265837|Brandov|Most|5|298
00509299|Dobšín|Mladá Boleslav|1|298
00509698|Kotopeky|Beroun|1|298
00248657|Mladé Bříště|Pelhřimov|9|298
00508951|Nová Telib|Mladá Boleslav|1|298
00243302|Smolotely|Příbram|1|298
00576271|Svésedlice|Olomouc|11|298
00568759|Ublo|Zlín|12|298
00281131|Uhřice|Blansko|10|298
00509027|Vinařice|Mladá Boleslav|1|298
42634491|Čížov|Jihlava|9|297
00663981|Dolany|Kladno|1|297
00271136|Vejvanovice|Chrudim|8|297
00267228|Bojiště|Havlíčkův Brod|9|296
00255289|Budětice|Klatovy|3|296
00526053|Drahobuz|Litoměřice|5|296
00275212|Osečnice|Rychnov nad Kněžnou|7|296
00368679|Podbřežice|Vyškov|10|296
00555215|Přestavlky|Litoměřice|5|296
00276065|Roprachtice|Semily|6|296
00259632|Šindelová|Sokolov|4|296
00639753|Vrátkov|Kolín|1|296
00579441|Banín|Svitavy|8|295
00556246|Blažim|Louny|5|295
00578321|Dřevěnice|Jičín|7|295
00378011|Láz|Třebíč|9|295
00487872|Tvorovice|Prostějov|11|295
00262251|Výsluní|Chomutov|5|295
00475785|Bohdalovice|Český Krumlov|2|294
00526118|Evaň|Litoměřice|5|294
00478547|Hlohová|Domažlice|3|294
00577065|Nižní Lhoty|Frýdek - Místek|13|294
00232599|Rabyně|Benešov|1|294
00637114|Vranovská Ves|Znojmo|10|294
00574163|Dolce|Plzeň - jih|3|293
00267503|Hradec|Havlíčkův Brod|9|293
00239445|Milčice|Nymburk|1|293
00573094|Nevřeň|Plzeň - sever|3|293
00635821|Seninka|Vsetín|12|293
00279854|Žampach|Ústí nad Orlicí|8|293
00600113|Bantice|Znojmo|10|292
00599298|Bohuňov|Žďár nad Sázavou|9|292
00600377|Horní Kounice|Znojmo|10|292
00667668|Litochovice|Strakonice|2|292
00264377|Slatina|Litoměřice|5|292
00272108|Sobčice|Jičín|7|292
00279285|Svatý Jiří|Ústí nad Orlicí|8|292
00581674|Čížkrajice|České Budějovice|2|291
00526142|Hlinná|Litoměřice|5|291
00377961|Krahulov|Třebíč|9|291
00663999|Malé Přítočno|Kladno|1|291
00269301|Petrovice|Hradec Králové|7|291
00573078|Plešnice|Plzeň - sever|3|291
00260151|Staré Sedlo|Tachov|3|291
00831689|Svojkov|Česká Lípa|6|291
00272221|Třebnouševes|Jičín|7|291
00271110|Vápenný Podol|Chrudim|8|291
00273228|Vysoká Srbská|Náchod|7|291
00578282|Butoves|Jičín|7|290
00257672|Dolany|Plzeň - sever|3|290
00288322|Jesenec|Prostějov|11|290
00472034|Klokočná|Praha - východ|1|290
00665134|Konojedy|Praha - východ|1|290
00667315|Zlukov|Tábor|2|290
00268593|Barchov|Hradec Králové|7|289
00234150|Blevice|Kladno|1|289
00249823|Lety|Písek|2|289
00579998|Okrouhlička|Havlíčkův Brod|9|289
00228699|Předmíř|Strakonice|2|289
00573833|Všenice|Rokycany|3|289
00288098|Buková|Prostějov|11|288
00372293|Chvalkovice|Vyškov|10|288
00249670|Hrazany|Písek|2|288
00544183|Jívoví|Žďár nad Sázavou|9|288
00508454|Kladruby|Benešov|1|288
00378143|Markvartice|Třebíč|9|288
00572713|Milíkov|Cheb|4|288
00274381|Svojšice|Pardubice|8|288
00850659|Výkleky|Přerov|11|288
00667331|Žíšov|Tábor|2|288
18243631|Kornatice|Rokycany|3|287
00232131|Libež|Benešov|1|287
00876291|Pětihosty|Praha - východ|1|287
00637769|Újezd u Černé Hory|Blansko|10|287
00637092|Vítonice|Znojmo|10|287
00373621|Bílý Kámen|Jihlava|9|286
00635251|Kopřivná|Šumperk|11|286
00667129|Řepeč|Tábor|2|286
00275603|Bělá|Semily|6|285
00273554|Hlavečník|Pardubice|8|285
00256749|Kbel|Plzeň - jih|3|285
00243931|Kroučová|Rakovník|1|285
00251470|Mečichov|Strakonice|2|285
00253634|Nemanice|Domažlice|3|285
00600555|Újezd|Žďár nad Sázavou|9|285
00302406|Branná|Šumperk|11|284
46772731|Dolánky nad Ohří|Litoměřice|5|284
00292800|Horní Dubňany|Znojmo|10|284
00287199|Horní Lapač|Kroměříž|12|284
00244201|Panoší Újezd|Rakovník|1|284
00544540|Třebětice|Kroměříž|12|284
00582867|Turovec|Tábor|2|284
00271292|Žumberk|Chrudim|8|284
00832316|Býčkovice|Litoměřice|5|283
00556211|Chotiměř|Litoměřice|5|283
00249637|Dražíč|České Budějovice|2|283
00672068|Heřmanice|Liberec|6|283
00239127|Hradčany|Nymburk|1|283
00242926|Obory|Příbram|1|283
64782701|Otradov|Chrudim|8|283
00275999|Peřimov|Semily|6|283
00515965|Putimov|Pelhřimov|9|283
00237493|Boreč|Mladá Boleslav|1|282
00483575|Dolní Bezděkov|Chrudim|8|282
00673170|Nezabylice|Chomutov|5|282
00288594|Otinoves|Prostějov|11|282
00580937|Řetůvka|Ústí nad Orlicí|8|282
00295752|Vlkov|Žďár nad Sázavou|9|282
00225606|Žerůtky|Znojmo|10|282
00250341|Borová Lada|Prachatice|2|281
00236101|Chabeřice|Kutná Hora|1|281
00576221|Dubčany|Olomouc|11|281
00576131|Ludvíkov|Bruntál|13|281
70891532|Pavlovice u Kojetína|Prostějov|11|281
70886814|Sytno|Tachov|3|281
00554588|Úpohlavy|Litoměřice|5|281
00599280|Bohdalec|Žďár nad Sázavou|9|280
00509205|Branžež|Mladá Boleslav|1|280
00600539|Březí nad Oslavou|Žďár nad Sázavou|9|280
00600644|Býkovice|Blansko|10|280
00600245|Ctidružice|Znojmo|10|280
00242870|Nové Dvory|Příbram|1|280
00243442|Třebsko|Příbram|1|280
00244571|Velká Buková|Rakovník|1|280
00599948|Záblatí|Žďár nad Sázavou|9|280
00577669|Bílá|Frýdek - Místek|13|279
00483362|Chlum|Česká Lípa|6|279
00369721|Dětkovice|Vyškov|10|279
00574031|Honezovice|Plzeň - jih|3|279
00237817|Horní Bukovina|Mladá Boleslav|1|279
46687718|Mutěnice|Strakonice|2|279
00508471|Pavlovice|Benešov|1|279
00480011|Skořice|Rokycany|3|279
00272175|Střevač|Jičín|7|279
00640433|Královice|Kladno|1|278
00545210|Krásněves|Žďár nad Sázavou|9|278
00637190|Lesní Hluboké|Brno - venkov|10|278
18243622|Medový Újezd|Rokycany|3|278
00573019|Myslinka|Plzeň - sever|3|278
47733438|Pláně|Plzeň - sever|3|278
00831387|Srbská Kamenice|Děčín|5|278
00481491|Zdislava|Liberec|6|278
00273376|Borek|Pardubice|8|277
00231801|Hulice|Benešov|1|277
00267619|Kamenná Lhota|Havlíčkův Brod|9|277
00842672|Katov|Brno - venkov|10|277
00545171|Malá Losenice|Žďár nad Sázavou|9|277
00599654|Pavlínov|Žďár nad Sázavou|9|277
00853101|Vyšehoří|Šumperk|11|277
00581666|Branišov|České Budějovice|2|276
00635341|Měrotín|Olomouc|11|276
00244228|Petrovice|Rakovník|1|276
46750690|Radvanec|Česká Lípa|6|276
00269727|Třesovice|Hradec Králové|7|276
00485365|Třibřichy|Chrudim|8|276
00236560|Vidice|Kutná Hora|1|276
00837300|Jestřabí|Zlín|12|275
00583481|Lidmaň|Pelhřimov|9|275
00279242|Mostek|Ústí nad Orlicí|8|275
00279307|Orličky|Ústí nad Orlicí|8|275
00662968|Sedlice|Příbram|1|275
00488348|Újezd u Rosic|Brno - venkov|10|275
00509876|Vižina|Beroun|1|275
15054225|Zderaz|Chrudim|8|275
00662895|Narysov|Příbram|1|274
00636533|Radvanice|Přerov|11|274
00267571|Jeřišno|Havlíčkův Brod|9|273
00289540|Jinošov|Třebíč|9|273
00473871|Osečany|Příbram|1|273
00257176|Roupov|Plzeň - jih|3|273
00640395|Semtěš|Kutná Hora|1|273
00244376|Senec|Rakovník|1|273
00637122|Vratěnín|Znojmo|10|273
00526771|Žabovřesky nad Ohří|Litoměřice|5|273
00637289|Žernovník|Blansko|10|273
45978123|Divec|Hradec Králové|7|272
00273635|Hrobice|Pardubice|8|272
00662267|Jeviněves|Mělník|1|272
00573647|Kokašice|Tachov|3|272
00653993|Lhota pod Hořičkami|Náchod|7|272
00515957|Libkova Voda|Pelhřimov|9|272
00579114|Lupenice|Rychnov nad Kněžnou|7|272
47934701|Mrlínek|Kroměříž|12|272
00250121|Smetanova Lhota|Písek|2|272
00274763|Bystré|Rychnov nad Kněžnou|7|271
00251267|Chrášťovice|Strakonice|2|271
00268887|Chudeřice|Hradec Králové|7|271
00532142|Pamětice|Blansko|10|271
00250040|Přeštěnice|Písek|2|271
00837296|Šarovy|Zlín|12|271
00573710|Trpísty|Tachov|3|271
00582999|Bušanovice|Prachatice|2|270
00543721|Měšín|Jihlava|9|270
00279382|Podlesí|Ústí nad Orlicí|8|270
00666955|Příbraz|Jindřichův Hradec|2|270
00509035|Rohatsko|Mladá Boleslav|1|270
00636550|Rouské|Přerov|11|270
00842346|Sazomín|Žďár nad Sázavou|9|270
00256081|Srní|Klatovy|3|270
00271683|Kněžnice|Jičín|7|269
00497011|Licibořice|Chrudim|8|269
00483877|Podhořany u Ronova|Chrudim|8|269
00248886|Pošná|Pelhřimov|9|269
00545279|Sirákov|Žďár nad Sázavou|9|269
00264369|Siřejovice|Litoměřice|5|269
00288748|Skalka|Prostějov|11|269
00875813|Soutice|Benešov|1|269
00670715|Těšovice|Sokolov|4|269
00509833|Točník|Beroun|1|269
00511226|Vystrkov|Pelhřimov|9|269
00875953|Zbožíčko|Nymburk|1|269
00599263|Blažkov|Žďár nad Sázavou|9|268
00508896|Dalovice|Mladá Boleslav|1|268
00248371|Kámen|Pelhřimov|9|268
00572560|Mutěnín|Domažlice|3|268
00286559|Řásná|Jihlava|9|268
00850705|Špičky|Přerov|11|268
00366072|Všechovice|Brno - venkov|10|268
00270491|Míčov-Sušice|Chrudim|8|267
00488569|Obědkovice|Prostějov|11|267
00290548|Svatoslav|Třebíč|9|267
00268488|Vilémovice|Havlíčkův Brod|9|267
00271322|Běchary|Jičín|7|266
00509647|Chlustina|Beroun|1|266
00512036|Dolní Novosedly|Písek|2|266
00233293|Hvozdec|Beroun|1|266
04521811|Kozlov|Olomouc|11|266
00509019|Plužná|Mladá Boleslav|1|266
00274160|Rohoznice|Pardubice|8|266
00277410|Strakov|Svitavy|8|266
00236578|Vinaře|Kutná Hora|1|266
00271357|Boháňka|Jičín|7|265
00473812|Hudčice|Příbram|1|265
00265993|Korozluky|Most|5|265
00831379|Kunratice|Děčín|5|265
00287377|Kurovice|Kroměříž|12|265
00276995|Mikuleč|Svitavy|8|265
49180509|Nezbavětice|Plzeň - město|3|265
00368661|Uhřice|Vyškov|10|265
00511196|Včelnička|Pelhřimov|9|265
47884541|Velenov|Blansko|10|265
00280232|Horní Poříčí|Blansko|10|264
00257826|Hvozd|Plzeň - sever|3|264
00257982|Krsy|Plzeň - sever|3|264
00251542|Myštice|Strakonice|2|264
00272078|Samšina|Jičín|7|264
00556441|Toužetín|Louny|5|264
00542288|Újezdec|Uherské Hradiště|12|264
15060900|Vysoká|Havlíčkův Brod|9|264
00473782|Žabonosy|Kolín|1|264
04498682|Bražec|Karlovy Vary|4|263
00600369|Horní Břečkov|Znojmo|10|263
00579581|Nová Sídla|Svitavy|8|263
00545651|Nová Ves|Třebíč|9|263
00574180|Předenice|Plzeň - jih|3|263
00637785|Prostřední Poříčí|Blansko|10|263
00244279|Pšovlky|Rakovník|1|263
00277401|Stašov|Svitavy|8|263
00508900|Vinec|Mladá Boleslav|1|263
00275549|Zdelov|Rychnov nad Kněžnou|7|263
00480339|Čermná|Domažlice|3|262
00581402|Chotýčany|České Budějovice|2|262
00234371|Hořešovice|Kladno|1|262
00246735|Horní Radouň|Jindřichův Hradec|2|262
00287326|Komárno|Kroměříž|12|262
00600024|Koválovice-Osíčany|Prostějov|11|262
00275000|Králova Lhota|Rychnov nad Kněžnou|7|262
00488194|Ledce|Brno - venkov|10|262
00842699|Níhov|Brno - venkov|10|262
00279340|Petrovice|Ústí nad Orlicí|8|262
00236446|Staňkovice|Kutná Hora|1|262
00653438|Zachrašťany|Hradec Králové|7|262
00235237|Barchovice|Kolín|1|261
00269913|Ctětín|Chrudim|8|261
00273708|Jaroslav|Pardubice|8|261
00254011|Křižovatka|Cheb|4|261
00673226|Líšný|Jablonec nad Nisou|6|261
00511722|Mišovice|Písek|2|261
42634521|Panenská Rozsíčka|Jihlava|9|261
00580953|Sobkovice|Ústí nad Orlicí|8|261
00831727|Tuhaň|Česká Lípa|6|261
00249289|Velká Chyška|Pelhřimov|9|261
00532088|Brumov|Brno - venkov|10|260
00636207|Dolní Nětčice|Přerov|11|260
00635294|Hlásnice|Olomouc|11|260
00666882|Horní Skrýchov|Jindřichův Hradec|2|260
42634628|Jezdovice|Jihlava|9|260
00636363|Lipová|Přerov|11|260
00545759|Poděšín|Žďár nad Sázavou|9|260
00235857|Veletov|Kolín|1|260
00236586|Vlačice|Kutná Hora|1|260
00581968|Zvíkov|České Budějovice|2|260
00276634|Hartmanice|Svitavy|8|259
44444371|Kobylice|Hradec Králové|7|259
00555983|Lobendava|Děčín|5|259
48838756|Rybníček|Vyškov|10|259
48679763|Sedlec|Mladá Boleslav|1|259
00600288|Dobelice|Znojmo|10|258
47919779|Hruška|Prostějov|11|258
00380865|Karolín|Kroměříž|12|258
00600482|Lesná|Znojmo|10|258
00035513|Staré Smrkovice|Jičín|7|258
00288845|Šubířov|Prostějov|11|258
00511269|Ústrašín|Pelhřimov|9|258
00274615|Vyšehněvice|Pardubice|8|258
00375390|Biskupice-Pulkov|Třebíč|9|257
00239062|Dobšice|Nymburk|1|257
00488429|Dražůvky|Hodonín|10|257
00301361|Klokočí|Přerov|11|257
00636355|Líšná|Přerov|11|257
00636843|Lukov|Znojmo|10|257
00270661|Perálec|Chrudim|8|257
00270725|Pokřikov|Chrudim|8|257
48527467|Příštpo|Třebíč|9|257
00277291|Rozstání|Svitavy|8|257
00273031|Slavětín nad Metují|Náchod|7|257
00580643|Třebosice|Pardubice|8|257
00252131|Březnice|Tábor|2|256
00599361|Dlouhé|Žďár nad Sázavou|9|256
00296066|Janov|Bruntál|13|256
00233391|Koněprusy|Beroun|1|256
00278025|Kuks|Trutnov|7|256
00280461|Kuničky|Blansko|10|256
00479411|Liblín|Rokycany|3|256
00581852|Planá|České Budějovice|2|256
00232688|Smilkov|Benešov|1|256
00362506|Tučapy|Uherské Hradiště|12|256
00484776|Velký Vřešťov|Trutnov|7|256
00869066|Benešovice|Tachov|3|255
00261793|Bílence|Chomutov|5|255
00479705|Boží Dar|Karlovy Vary|4|255
00259748|Cebiv|Tachov|3|255
00640646|Choťovice|Kolín|1|255
00242331|Chraštice|Příbram|1|255
00277754|Dolní Dvůr|Trutnov|7|255
00572900|Loza|Plzeň - sever|3|255
00251488|Miloňovice|Strakonice|2|255
00281263|Vísky|Blansko|10|255
00508357|Chrášťany|Benešov|1|254
00194611|Gruna|Svitavy|8|254
00572349|Horní Kamenice|Plzeň - jih|3|254
00261921|Kalek|Chomutov|5|254
00600491|Lesonice|Znojmo|10|254
00572691|Okrouhlá|Cheb|4|254
00572721|Vojtanov|Cheb|4|254
00573787|Brod nad Tichou|Tachov|3|253
00278581|Bučina|Ústí nad Orlicí|8|253
00251101|Doubravice|Strakonice|2|253
00832189|Kámen|Děčín|5|253
00238384|Obruby|Mladá Boleslav|1|253
00258989|Podmokly|Rokycany|3|253
00841846|Světlá|Blansko|10|253
00667226|Val|Tábor|2|253
00576034|Valšov|Bruntál|13|253
00635766|Želechovice|Olomouc|11|253
00544698|Kelčany|Hodonín|10|252
00640581|Netřebice|Nymburk|1|252
00667757|Nišovice|Strakonice|2|252
00842168|Nové Sady|Žďár nad Sázavou|9|252
00242993|Ouběnice|Příbram|1|252
00580791|Paseky nad Jizerou|Semily|6|252
00380849|Prasklice|Kroměříž|12|252
00849979|Svatoňovice|Opava|13|252
00512028|Žďár|Písek|2|252
00488542|Alojzov|Prostějov|11|251
00636665|Bedřichov|Blansko|10|251
00376981|Horní Újezd|Třebíč|9|251
00275794|Jestřabí v Krkonoších|Semily|6|251
00667714|Mnichov|Strakonice|2|251
00296252|Norberčany|Olomouc|11|251
00252743|Radětice|Tábor|2|251
00236390|Řendějov|Kutná Hora|1|251
00573825|Týček|Rokycany|3|251
00573876|Vejvanov|Rokycany|3|251
00666564|Zahrádky|Jindřichův Hradec|2|251
00246646|Hatín|Jindřichův Hradec|2|250
00600440|Křídlůvky|Znojmo|10|250
00266060|Malé Březno|Most|5|250
00509809|Podbrdy|Beroun|1|250
00640760|Roblín|Praha - západ|1|250
00543781|Záborná|Jihlava|9|250
00252093|Borkovice|Tábor|2|249
00578258|Bříšťany|Jičín|7|249
00239054|Dlouhopolsko|Nymburk|1|249
00296732|Hrčava|Frýdek - Místek|13|249
00401269|Oucmanice|Ústí nad Orlicí|8|249
00271977|Podůlší|Jičín|7|249
00287784|Střížovice|Kroměříž|12|249
00256471|Buková|Plzeň - jih|3|248
00509639|Bykoš|Beroun|1|248
00573736|Horní Kozolupy|Tachov|3|248
00243752|Hřebečníky|Rakovník|1|248
15060896|Hurtova Lhota|Havlíčkův Brod|9|248
00636495|Přestavlky|Přerov|11|248
00857564|Říkov|Náchod|7|248
00853143|Zborov|Šumperk|11|248
00673340|Bohatice|Česká Lípa|6|247
00271462|Češov|Jičín|7|247
00509124|Chudíř|Mladá Boleslav|1|247
00568538|Dobrkovice|Zlín|12|247
00665096|Drahobudice|Kolín|1|247
00236080|Hostovlice|Kutná Hora|1|247
00261351|Hřensko|Děčín|5|247
00377627|Kojatice|Třebíč|9|247
00287571|Pacetluky|Kroměříž|12|247
00667811|Rovná|Strakonice|2|247
00243264|Sádek|Příbram|1|247
00273406|Bukovina nad Labem|Pardubice|8|246
00259292|Dasnice|Sokolov|4|246
00556289|Deštnice|Louny|5|246
00579866|Jitkov|Havlíčkův Brod|9|246
00532151|Rašov|Brno - venkov|10|246
46276050|Rudimov|Zlín|12|246
00378585|Sedlec|Třebíč|9|246
00636649|Turovice|Přerov|11|246
00272400|Vršce|Jičín|7|246
00831841|Vršovice|Louny|5|246
00496995|Vyžice|Chrudim|8|246
00639796|Děkov|Rakovník|1|245
00278998|Javorník|Ústí nad Orlicí|8|245
00545686|Koroužné|Žďár nad Sázavou|9|245
00272833|Mezilesí|Náchod|7|245
00509302|Obrubce|Mladá Boleslav|1|245
00252620|Oldřichov|Tábor|2|245
00573281|Smolné Pece|Karlovy Vary|4|245
00373923|Suchá|Jihlava|9|245
18246087|Tatiná|Plzeň - sever|3|245
00573671|Zadní Chodov|Tachov|3|245
00600890|Žákovice|Přerov|11|245
00272451|Žlunice|Jičín|7|245
00545376|Bobrůvka|Žďár nad Sázavou|9|244
00237698|Dolní Krupá|Mladá Boleslav|1|244
47922575|Dzbel|Prostějov|11|244
00573639|Milíře|Tachov|3|244
00269140|Mlékosrby|Hradec Králové|7|244
00635391|Moravice|Opava|13|244
00579092|Nová Ves|Rychnov nad Kněžnou|7|244
00273724|Jeníkovice|Pardubice|8|243
00580821|Ktová|Semily|6|243
00378151|Martínkov|Třebíč|9|243
00572381|Poděvousy|Domažlice|3|243
00251691|Předslavice|Strakonice|2|243
00636681|Vážany|Blansko|10|243
00235903|Vlkančice|Praha - východ|1|243
00257869|Chříč|Plzeň - sever|3|242
00234770|Pavlov|Kladno|1|242
00636746|Unín|Brno - venkov|10|242
00265683|Vinařice|Louny|5|242
00654001|Brzice|Náchod|7|241
42634644|Cerekvička-Rosice|Jihlava|9|241
00869023|Kšice|Tachov|3|241
00236209|Ledečko|Kutná Hora|1|241
00578436|Lískovice|Jičín|7|241
00244236|Pochvalov|Rakovník|1|241
00235024|Třebíz|Kladno|1|241
00667293|Zálší|Tábor|2|241
00637378|Čejkovice|Znojmo|10|240
00256641|Chlum|Plzeň - jih|3|240
00376795|Číhalín|Třebíč|9|240
00875961|Čilec|Nymburk|1|240
18246052|Křelovice|Plzeň - sever|3|240
00671975|Lažany|Liberec|6|240
00654647|Lipovec|Chrudim|8|240
00232246|Miřetice|Benešov|1|240
00573663|Prostiboř|Tachov|3|240
00256048|Rejštejn|Klatovy|3|240
00637009|Slatina|Znojmo|10|240
00279803|Zálší|Ústí nad Orlicí|8|240
00368750|Bohaté Málkovice|Vyškov|10|239
00832561|Černěves|Litoměřice|5|239
00276723|Chrastavec|Svitavy|8|239
00362841|Heroltice|Brno - venkov|10|239
00635537|Kružberk|Opava|13|239
00276022|Příkrý|Semily|6|239
00556416|Raná|Louny|5|239
00654655|Bousov|Chrudim|8|238
00274992|Kounov|Rychnov nad Kněžnou|7|238
00842281|Počítky|Žďár nad Sázavou|9|238
00277355|Sklené|Svitavy|8|238
00295400|Sklené nad Oslavou|Žďár nad Sázavou|9|238
00269581|Sovětice|Hradec Králové|7|238
00580112|Stříbrné Hory|Havlíčkův Brod|9|238
00667871|Tchořovice|Strakonice|2|238
00576000|Tvrdkov|Bruntál|13|238
00276243|Veselá|Semily|6|238
00266663|Žim|Teplice|5|238
00576239|Bílsko|Olomouc|11|237
00849952|Jezdkovice|Opava|13|237
00277991|Klášterská Lhota|Trutnov|7|237
00248479|Křeč|Pelhřimov|9|237
00572802|Odrava|Cheb|4|237
00473898|Radíč|Příbram|1|237
00251780|Skočice|Strakonice|2|237
00599921|Věžná|Žďár nad Sázavou|9|237
00831531|Kvítkov|Česká Lípa|6|236
00599786|Rudolec|Žďár nad Sázavou|9|236
00640590|Starý Vestec|Nymburk|1|236
00636592|Stříbrnice|Přerov|11|236
00579793|Bezděkov|Havlíčkův Brod|9|235
00251364|Kraselov|Strakonice|2|235
00673153|Libědice|Chomutov|5|235
00275964|Olešnice|Semily|6|235
00519391|Raková|Rokycany|3|235
00580597|Újezd u Sezemic|Pardubice|8|235
00666556|Velký Ratmírov|Jindřichův Hradec|2|235
00573469|Červené Poříčí|Klatovy|3|234
00581011|Hřibojedy|Trutnov|7|234
00509094|Hrušov|Mladá Boleslav|1|234
00509256|Košátky|Mladá Boleslav|1|234
00266132|Polerady|Most|5|234
00639745|Štíhlice|Praha - východ|1|234
00246166|Světlík|Český Krumlov|2|234
00276189|Syřenov|Semily|6|234
00511773|Vlastec|Písek|2|234
00515809|Zachotín|Pelhřimov|9|234
00580848|Žernov|Semily|6|234
00525529|Jílové u Držkova|Jablonec nad Nisou|6|233
00578380|Kbelnice|Jičín|7|233
00662909|Nepomuk|Příbram|1|233
00636797|Nový Poddvorov|Hodonín|10|233
00275158|Očelice|Rychnov nad Kněžnou|7|233
00578487|Osek|Jičín|7|233
00573884|Újezd u Svatého Kříže|Rokycany|3|233
00572446|Velký Malahov|Domažlice|3|233
00272434|Žeretice|Jičín|7|233
00636193|Dobrčice|Přerov|11|232
00369811|Dobročkovice|Vyškov|10|232
00599387|Heřmanov|Žďár nad Sázavou|9|232
00854671|Horka u Staré Paky|Semily|6|232
00636258|Horní Nětčice|Přerov|11|232
00286028|Jihlávka|Jihlava|9|232
00275816|Kacanovy|Semily|6|232
00270253|Kladno|Chrudim|8|232
00544591|Nítkovice|Kroměříž|12|232
00635880|Police|Šumperk|11|232
00639958|Přílepy|Rakovník|1|232
00280861|Rohozec|Brno - venkov|10|232
00274500|Újezd u Přelouče|Pardubice|8|232
00531669|Chlumětín|Žďár nad Sázavou|9|231
46276076|Karlovice|Zlín|12|231
00473855|Lešetice|Příbram|1|231
00581453|Mazelov|České Budějovice|2|231
00287270|OBEC CHVALNOV-LÍSKY|Kroměříž|12|231
00475483|Pohorská Ves|Český Krumlov|2|231
00274119|Přelovice|Pardubice|8|231
00508497|Řimovice|Benešov|1|231
00373940|Šimanov|Jihlava|9|231
00271187|Vortová|Chrudim|8|231
00840581|Zbraslavec|Blansko|10|231
00508390|Chářovice|Benešov|1|230
00376817|Číměř|Třebíč|9|230
00672041|Horní Řasnice|Liberec|6|230
00258741|Hůrky|Rokycany|3|230
00665142|Kšely|Kolín|1|230
00542245|Lopeník|Uherské Hradiště|12|230
00511200|Rodinov|Pelhřimov|9|230
00293512|Starý Petřín|Znojmo|10|230
00555894|Starý Šachov|Děčín|5|230
00842176|Ždánice|Žďár nad Sázavou|9|230
00265829|Bělušice|Most|5|229
00275620|Bradlecká Lhota|Semily|6|229
00267660|Kozlov|Havlíčkův Brod|9|229
00267724|Květinov|Havlíčkův Brod|9|229
00511609|Onšov|Pelhřimov|9|229
00580503|Časy|Pardubice|8|228
00251143|Drážov|Strakonice|2|228
00512974|Dunajovice|Jindřichův Hradec|2|228
00842273|Lhotka|Žďár nad Sázavou|9|228
00526151|Mlékojedy|Litoměřice|5|228
00572292|Nový Kramolín|Domažlice|3|228
00257117|Prádlo|Plzeň - jih|3|228
48333344|Přestavlky|Plzeň - jih|3|228
00277347|Sedliště|Svitavy|8|228
00600881|Zámrsky|Přerov|11|228
00556505|Žerotín|Louny|5|228
00373796|Krasonice|Jihlava|9|227
00296147|Křišťanovice|Bruntál|13|227
00515795|Zajíčkov|Pelhřimov|9|227
00600121|Bezkov|Znojmo|10|226
00832201|Habrovany|Ústí nad Labem|5|226
00270032|Hamry|Chrudim|8|226
00636240|Hlinsko|Přerov|11|226
00555991|Labská Stráň|Děčín|5|226
00581798|Nákří|České Budějovice|2|226
00640387|Paběnice|Kutná Hora|1|226
00235733|Skvrňov|Kolín|1|226
00249327|Veselá|Pelhřimov|9|226
00556874|Zubrnice|Ústí nad Labem|5|226
00295868|Bílčice|Bruntál|13|225
00232807|Bílkovice|Benešov|1|225
00273384|Brloh|Pardubice|8|225
43256201|Dalešice|Jablonec nad Nisou|6|225
00512605|Drhovice|Tábor|2|225
47274221|Janská|Děčín|5|225
00573574|Obytce|Klatovy|3|225
00636827|Ostrovánky|Hodonín|10|225
00512061|Rakovice|Písek|2|225
00253715|Semněvice|Domažlice|3|225
00578592|Sukorady|Jičín|7|225
00848514|Vrchy|Nový Jičín|13|225
00179612|Bělá|Havlíčkův Brod|9|224
00512265|Buřenice|Pelhřimov|9|224
00377589|Kamenná|Třebíč|9|224
00842681|Křižínkov|Brno - venkov|10|224
48333468|Milínov|Plzeň - jih|3|224
00286303|Nevcehle|Jihlava|9|224
00640484|Poštovice|Kladno|1|224
42634512|Radkov|Jihlava|9|224
00868965|Sulislav|Tachov|3|224
00274691|Bartošovice v Orlických horách|Rychnov nad Kněžnou|7|223
00473359|Bernartice|Benešov|1|223
00246379|Budeč|Jindřichův Hradec|2|223
00662852|Chrást|Příbram|1|223
00545643|Číchov|Třebíč|9|223
00253774|Stráž|Domažlice|3|223
00580180|Strážné|Trutnov|7|223
00252221|Dráchov|Tábor|2|222
00579955|Michalovice|Havlíčkův Brod|9|222
00667145|Sedlečko u Soběslavě|Tábor|2|222
00542237|Svárov|Uherské Hradiště|12|222
00476463|Veselíčko|Písek|2|222
00573388|Borovy|Plzeň - jih|3|221
00573477|Číhaň|Klatovy|3|221
00672050|Hlavice|Liberec|6|221
00477435|Jinín|Strakonice|2|221
48770566|Komárov|Olomouc|11|221
00232262|Mnichovice|Benešov|1|221
00637441|Morašice|Znojmo|10|221
00635669|Olbramice|Olomouc|11|221
00572276|Pařezov|Domažlice|3|221
00512729|Roseč|Jindřichův Hradec|2|221
00574261|Skašov|Plzeň - jih|3|221
49864009|Tachov|Česká Lípa|6|221
00272370|Volanice|Jičín|7|221
00373991|Zbilidy|Jihlava|9|221
00654141|Borová|Náchod|7|220
00580201|Borovnička|Trutnov|7|220
00581194|Bošilec|České Budějovice|2|220
00841790|Chrudichromy|Blansko|10|220
44626738|Jarov|Plzeň - jih|3|220
00273741|Kasalice|Pardubice|8|220
00600181|Kašnice|Břeclav|10|220
00573795|Kočov|Tachov|3|220
00378615|Slavětice|Třebíč|9|220
00250686|Stožec|Prachatice|2|220
00581895|Střížov|České Budějovice|2|220
00526452|Záluží|Litoměřice|5|220
00578347|Choteč|Jičín|7|219
00653314|Lejšovka|Hradec Králové|7|219
00635375|Lhotka u Litultovic|Opava|13|219
00583065|Lipovice|Prachatice|2|219
44444419|Máslojedy|Hradec Králové|7|219
46769463|Miřejovice|Litoměřice|5|219
00640565|Páleč|Kladno|1|219
00252786|Rataje|Tábor|2|219
00274356|Stojice|Pardubice|8|219
00274429|Trusnov|Pardubice|8|219
00271314|Bašnice|Jičín|7|218
00473839|Kotenčice|Příbram|1|218
00255718|Křenice|Klatovy|3|218
00572225|Mnichov|Domažlice|3|218
00509370|Pěčice|Mladá Boleslav|1|218
00640638|Seletice|Nymburk|1|218
00572438|Spáňov|Domažlice|3|218
00263222|Sychrov|Liberec|6|218
00508420|Tisem|Benešov|1|218
00256251|Velké Hydčice|Klatovy|3|218
47930292|Blazice|Kroměříž|12|217
00580198|Lanžov|Trutnov|7|217
00488062|Odrovice|Brno - venkov|10|217
00666483|Okrouhlá Radouň|Jindřichův Hradec|2|217
00268917|Káranice|Hradec Králové|7|216
00665118|Kbel|Kolín|1|216
00640361|Kobylnice|Kutná Hora|1|216
00637246|Nýrov|Blansko|10|216
00636614|Šišma|Přerov|11|216
00286796|Ústí|Jihlava|9|216
46276033|Vlachova Lhota|Zlín|12|216
00278483|Zlatá Olešnice|Trutnov|7|216
44065540|Zvěrkovice|Třebíč|9|216
00375357|Babice|Třebíč|9|215
00275646|Bukovina u Čisté|Semily|6|215
00532118|Deštná|Blansko|10|215
00637386|Grešlové Mýto|Znojmo|10|215
00278831|Hejnice|Ústí nad Orlicí|8|215
00573540|Ježovy|Klatovy|3|215
45331006|Lhůta|Plzeň - město|3|215
00841889|Malá Roudka|Blansko|10|215
00236250|Nepoměřice|Kutná Hora|1|215
00511706|Boudy|Písek|2|214
00578339|Cholenice|Jičín|7|214
00542296|Hostětín|Uherské Hradiště|12|214
00256625|Hradiště|Plzeň - jih|3|214
00831999|Kamýk|Litoměřice|5|214
00256765|Klášter|Plzeň - jih|3|214
00576247|Loučka|Olomouc|11|214
00256994|Netunice|Plzeň - jih|3|214
00526789|Píšťany|Litoměřice|5|214
00572683|Podhradí|Cheb|4|214
00578614|Šárovcova Lhota|Jičín|7|214
00640450|Bílichov|Kladno|1|213
00545635|Bransouze|Třebíč|9|213
00489450|Březí|Žďár nad Sázavou|9|213
00581305|Heřmaň|České Budějovice|2|213
00376841|Hluboké|Třebíč|9|213
00248436|Komorovice|Pelhřimov|9|213
00662879|Lazsko|Příbram|1|213
00639923|Milý|Rakovník|1|213
00236284|Okřesaneč|Kutná Hora|1|213
00473740|Polní Voděrady|Kolín|1|213
00236403|Samopše|Kutná Hora|1|213
00232831|Tichonice|Benešov|1|213
00279820|Zářecká Lhota|Ústí nad Orlicí|8|213
00599964|Znětínek|Žďár nad Sázavou|9|213
45978484|Babice|Hradec Králové|7|212
00662763|Bohostice|Příbram|1|212
00242551|Křepenice|Příbram|1|212
00672076|Loužnice|Jablonec nad Nisou|6|212
00509132|Mukařov|Mladá Boleslav|1|212
00599662|Pernštejnské Jestřabí|Brno - venkov|10|212
00573906|Skomelno|Rokycany|3|212
00576077|Staré Heřminovy|Bruntál|13|212
47733373|Vysoká Libyně|Plzeň - sever|3|212
00228702|Čepřovice|Strakonice|2|211
00572896|Líté|Plzeň - sever|3|211
00573370|Nezdice|Plzeň - jih|3|211
00662216|Stránka|Mělník|1|211
00667889|Truskovice|Strakonice|2|211
00640476|Vrbičany|Kladno|1|211
00240001|Žitovlice|Nymburk|1|211
00362832|Braníškov|Brno - venkov|10|210
00484466|Dvakačovice|Chrudim|8|210
00635979|Jakubovice|Šumperk|11|210
00377996|Krokočín|Třebíč|9|210
00600474|Lančov|Znojmo|10|210
00574228|Měcholupy|Plzeň - jih|3|210
00266485|Mikulov|Teplice|5|210
00378186|Mikulovice|Třebíč|9|210
00473863|Občov|Příbram|1|210
00572195|Pec|Domažlice|3|210
00498572|Podveky|Kutná Hora|1|210
00275352|Sedloňov|Rychnov nad Kněžnou|7|210
00875520|Želenice|Kladno|1|210
00573396|Břežany|Klatovy|3|209
00373672|Dvorce|Jihlava|9|209
00581364|Hranice|České Budějovice|2|209
00288276|Hrdibořice|Prostějov|11|209
00580813|Klokočí|Semily|6|209
00600636|Kunice|Blansko|10|209
00267848|Malčín|Havlíčkův Brod|9|209
00250970|Bílsko|Strakonice|2|208
00576107|Hlinka|Bruntál|13|208
00378160|Mastník|Třebíč|9|208
00262081|Pětipsy|Chomutov|5|208
00244252|Příčina|Rakovník|1|208
00246107|Přísečná|Český Krumlov|2|208
00296295|Roudno|Bruntál|13|208
00640603|Velenice|Nymburk|1|208
00511307|Vokov|Pelhřimov|9|208
00640468|Zichovec|Kladno|1|208
00511455|Borovany|Písek|2|207
00572284|Drahotín|Domažlice|3|207
00635928|Hraběšice|Šumperk|11|207
00636720|Křtěnov|Blansko|10|207
00266019|Lišnice|Most|5|207
00509281|Loukov|Mladá Boleslav|1|207
00257141|Ptenín|Plzeň - jih|3|207
00515931|Velký Rybník|Pelhřimov|9|207
00600857|Věžky|Přerov|11|207
00869007|Vranov|Tachov|3|207
00639699|Bratřínov|Praha - západ|1|206
00579548|Chmelík|Svitavy|8|206
00568520|Dešná|Zlín|12|206
43420613|Lazinov|Blansko|10|206
00259519|Nová Ves|Sokolov|4|206
00512711|Ratiboř|Jindřichův Hradec|2|206
00832570|Sedlec|Litoměřice|5|206
00234974|Šlapanice|Kladno|1|206
00635332|Slavětín|Olomouc|11|206
00573302|Vrbice|Karlovy Vary|4|206
00556483|Vrbno nad Lesy|Louny|5|206
00532070|Běleč|Brno - venkov|10|205
00274917|Chleny|Rychnov nad Kněžnou|7|205
00275204|Orlické Záhoří|Rychnov nad Kněžnou|7|205
00876003|Podmoky|Nymburk|1|205
00842397|Vysoké|Žďár nad Sázavou|9|205
00274712|Bohdašín|Rychnov nad Kněžnou|7|204
00555223|Chotiněves|Litoměřice|5|204
00273686|Chýšť|Pardubice|8|204
00479110|Líšná|Rokycany|3|204
00248673|Moraveč|Pelhřimov|9|204
00581879|Radošovice|České Budějovice|2|204
00876038|Senice|Nymburk|1|204
00509825|Svatý Jan pod Skalou|Beroun|1|204
48156931|Trnávka|Pardubice|8|204
00599905|Unčín|Žďár nad Sázavou|9|204
00599981|Březsko|Prostějov|11|203
00274771|Byzhradec|Rychnov nad Kněžnou|7|203
00287121|Cetechovice|Kroměříž|12|203
00377601|Kladeruby nad Oslavou|Třebíč|9|203
00279153|Libecina|Ústí nad Orlicí|8|203
00286281|Mysliboř|Jihlava|9|203
00269166|Myštěves|Hradec Králové|7|203
00600041|Ochoz|Prostějov|11|203
00573582|Olšany|Klatovy|3|203
00286346|Opatov|Jihlava|9|203
04498356|Polná na Šumavě|Český Krumlov|2|203
00259012|Přívětice|Rokycany|3|203
45978786|Radíkovice|Hradec Králové|7|203
44065531|Vícenice|Třebíč|9|203
48222631|Chlum|Strakonice|2|202
00515787|Dobrá Voda|Pelhřimov|9|202
00239526|Okřínek|Nymburk|1|202
00636509|Radkova Lhota|Přerov|11|202
00279617|Šedivec|Ústí nad Orlicí|8|202
00580074|Skryje|Havlíčkův Brod|9|202
00666530|Staňkov|Jindřichův Hradec|2|202
00580767|Vilantice|Trutnov|7|202
00233366|Jivina|Beroun|1|201
00600512|Matějov|Žďár nad Sázavou|9|201
00637459|Našiměřice|Znojmo|10|201
00486264|Přestavlky|Chrudim|8|201
00637050|Tulešice|Znojmo|10|201
00473901|Velká Lečice|Příbram|1|201
00511765|Zvíkovské Podhradí|Písek|2|201
00375365|Bačice|Třebíč|9|200
00248223|Hořice|Pelhřimov|9|200
00272965|Přibyslav|Náchod|7|200
00579785|Bartoušov|Havlíčkův Brod|9|199
00476706|Cep|Jindřichův Hradec|2|199
00302643|Hynčina|Šumperk|11|199
00854051|Kosořín|Ústí nad Orlicí|8|199
00831123|Loučná pod Klínovcem|Chomutov|5|199
00572187|Nevolice|Domažlice|3|199
43313931|Nezamyslice|Klatovy|3|199
00640573|Plchov|Kladno|1|199
00238686|Strenice|Mladá Boleslav|1|199
00233935|Trubská|Beroun|1|199
60045493|Vernířovice|Šumperk|11|199
00544523|Bořenovice|Kroměříž|12|198
47733365|Čerňovice|Plzeň - sever|3|198
00488623|Dudín|Jihlava|9|198
00373729|Jersín|Jihlava|9|198
00249785|Králova Lhota|Písek|2|198
00636878|Milíčovice|Znojmo|10|198
00578452|Nevratice|Jičín|7|198
48471798|Podhradí|Zlín|12|198
00636479|Podolí|Přerov|11|198
00667862|Štěchovice|Strakonice|2|198
00672891|Velký Valtinov|Česká Lípa|6|198
00573868|Zvíkovec|Rokycany|3|198
00640654|Chroustov|Nymburk|1|197
00572519|Kanice|Domažlice|3|197
00488631|Markvartice|Jihlava|9|197
00667072|Nová Ves u Mladé Vožice|Tábor|2|197
00673323|Pesvice|Chomutov|5|197
00842206|Písečné|Žďár nad Sázavou|9|197
00635481|Třebom|Opava|13|197
00373613|Arnolec|Jihlava|9|196
00375381|Benetice|Třebíč|9|196
00243663|Branov|Rakovník|1|196
60419466|Častohostice|Třebíč|9|196
00476714|Červený Hrádek|Jindřichův Hradec|2|196
46684450|Drachkov|Strakonice|2|196
00578363|Jinolice|Jičín|7|196
00579891|Kouty|Havlíčkův Brod|9|196
00256978|Nekvasovy|Plzeň - jih|3|196
00556882|Ryjice|Ústí nad Labem|5|196
00582506|Běleč|Tábor|2|195
00376809|Čikov|Třebíč|9|195
00373788|Knínice|Jihlava|9|195
00555959|Merboltice|Děčín|5|195
00573922|Němčovice|Rokycany|3|195
18246061|Ostrov u Bezdružic|Plzeň - sever|3|195
00572179|Pasečnice|Domažlice|3|195
00600067|Raková u Konice|Prostějov|11|195
47478179|Staré Hrady|Jičín|7|195
47930284|Vrbka|Kroměříž|12|195
00581291|Hartmanice|České Budějovice|2|194
00544213|Horní Libochová|Žďár nad Sázavou|9|194
00544191|Kozlov|Žďár nad Sázavou|9|194
00636410|Nelešovice|Přerov|11|194
48527459|Okřešice|Třebíč|9|194
00272337|Veliš|Jičín|7|194
00476471|Vrcovice|Písek|2|194
00580988|Anenská Studánka|Ústí nad Orlicí|8|193
00269883|Bořice|Chrudim|8|193
00377741|Kostníky|Třebíč|9|193
00599514|Kuklík|Žďár nad Sázavou|9|193
00832162|Lkáň|Litoměřice|5|193
00542890|Štěchov|Blansko|10|193
00366013|Vohančice|Brno - venkov|10|193
00475629|Čečelovice|Strakonice|2|192
46276041|Křekov|Zlín|12|192
00581046|Litíč|Trutnov|7|192
00653985|Vestec|Náchod|7|192
00268691|Čistěves|Hradec Králové|7|191
00637271|Hodonín|Blansko|10|191
00572501|Hradiště|Domažlice|3|191
00278131|Maršov u Úpice|Trutnov|7|191
00238317|Němčice|Mladá Boleslav|1|191
00486299|Červená Hora|Náchod|7|190
00512010|Paseky|Písek|2|190
00246085|Přední Výtoň|Český Krumlov|2|190
00542334|Vápenice|Uherské Hradiště|12|190
00599301|Borovnice|Žďár nad Sázavou|9|189
00190187|Hynčice|Náchod|7|189
00488470|Karlín|Hodonín|10|189
49534904|Kněžičky|Nymburk|1|189
00378313|Ostašov|Třebíč|9|189
00373893|Plandry|Jihlava|9|189
00508543|Vysoký Újezd|Benešov|1|189
00515981|Bohdalín|Pelhřimov|9|188
00599328|Bukov|Žďár nad Sázavou|9|188
00261840|Domašín|Chomutov|5|188
00600768|Heřmánky|Nový Jičín|13|188
00276766|Jarošov|Svitavy|8|188
00231975|Keblov|Benešov|1|188
00238147|Krásná Ves|Mladá Boleslav|1|188
00526444|Malíč|Litoměřice|5|188
00373842|Nadějov|Jihlava|9|188
00277053|Nedvězí|Svitavy|8|188
00519995|Nevid|Rokycany|3|188
00636096|Ostružná|Jeseník|11|188
00509795|Otmíče|Beroun|1|188
00279561|Studené|Ústí nad Orlicí|8|188
00578231|Brada-Rybníček|Jičín|7|187
00876208|Církvice|Kolín|1|187
00654639|Hluboká|Chrudim|8|187
00377562|Jasenice|Třebíč|9|187
00543764|Stáj|Jihlava|9|187
00636118|Bezuchov|Přerov|11|186
00278611|Čenkovice|Ústí nad Orlicí|8|186
00831590|Chotovice|Česká Lípa|6|186
00663972|Drnek|Kladno|1|186
00473715|Lipec|Kolín|1|186
00302911|Lipinka|Olomouc|11|186
00512001|Varvažov|Písek|2|186
00637106|Vracovice|Znojmo|10|186
00876127|Vrbice|Nymburk|1|186
00573507|Běhařov|Klatovy|3|185
00194514|Bezděčí u Trnávky|Svitavy|8|185
00637513|Biskoupky|Brno - venkov|10|185
00376787|Červená Lhota|Třebíč|9|185
00373761|Kamenná|Jihlava|9|185
47465549|Královec|Trutnov|7|185
00544205|Kundratice|Žďár nad Sázavou|9|185
00275557|Zdobnice|Rychnov nad Kněžnou|7|185
00234125|Běloky|Kladno|1|184
00600229|Bojanovice|Znojmo|10|184
00578291|Červená Třemešná|Jičín|7|184
00231614|Český Šternberk|Benešov|1|184
00578355|Chyjice|Jičín|7|184
00268828|Hrádek|Hradec Králové|7|184
00248495|Křešín|Pelhřimov|9|184
00473731|Polní Chrčice|Kolín|1|184
60799692|Řídeč|Olomouc|11|184
00488640|Rozseč|Jihlava|9|184
48527483|Slavíkovice|Třebíč|9|184
00572411|Vidice|Domažlice|3|184
00179671|Víska|Havlíčkův Brod|9|184
00277568|Víska u Jevíčka|Svitavy|8|184
00489468|Březské|Žďár nad Sázavou|9|183
00579491|Dětřichov u Moravské Třebové|Svitavy|8|183
00265969|Klíny|Most|5|183
00579882|Kochánov|Havlíčkův Brod|9|183
00667021|Meziříčí|Tábor|2|183
00579131|Mokré|Rychnov nad Kněžnou|7|183
00534919|Nové Lublice|Opava|13|183
00378291|Oponešice|Třebíč|9|183
00662950|Radětice|Příbram|1|183
00509434|Rokytovec|Mladá Boleslav|1|183
00576093|Slezské Pavlovice|Bruntál|13|183
00498581|Soběšín|Kutná Hora|1|183
00270971|Střemošice|Chrudim|8|183
00271063|Trojovice|Chrudim|8|183
00271829|Zelenecká Lhota|Jičín|7|183
00542351|Žítková|Uherské Hradiště|12|183
00600547|Budeč|Žďár nad Sázavou|9|182
00267970|Olešenka|Havlíčkův Brod|9|182
00581828|Ostrolovský Újezd|České Budějovice|2|182
00512702|Pleše|Jindřichův Hradec|2|182
00276171|Svojek|Semily|6|182
00519693|Terešov|Rokycany|3|182
00600091|Vitčice|Prostějov|11|182
00488887|Žeraviny|Hodonín|10|182
00249807|Kučeř|Písek|2|181
00636321|Lazníčky|Přerov|11|181
45978131|Libníkovice|Hradec Králové|7|181
00640379|Opatovice I|Kutná Hora|1|181
15054268|Ostrov|Chrudim|8|181
00511781|Křenovice|Písek|2|180
00637416|Kubšice|Znojmo|10|180
00250554|Němčice|Prachatice|2|180
00673234|Radčice|Jablonec nad Nisou|6|180
00671924|Soběslavice|Liberec|6|180
44936362|Suchonice|Olomouc|11|180
00883603|Velký Luh|Cheb|4|180
00667269|Vlkov|Tábor|2|180
00542342|Vyškovec|Uherské Hradiště|12|180
00478814|Cekov|Rokycany|3|179
00473511|Ctiboř|Benešov|1|179
00268771|Hněvčeves|Hradec Králové|7|179
00274984|Kostelecké Horky|Rychnov nad Kněžnou|7|179
00673421|Krompach|Česká Lípa|6|179
00662208|Nosálov|Mělník|1|179
00673439|Skalka u Doks|Česká Lípa|6|179
00270962|Stradouň|Ústí nad Orlicí|8|179
00287857|Uhřice|Kroměříž|12|179
00666874|Bednáreček|Jindřichův Hradec|2|178
00572870|Bučí|Plzeň - sever|3|178
00636711|Kněževes|Blansko|10|178
00599531|Kuřimské Jestřabí|Brno - venkov|10|178
00579254|Libel|Rychnov nad Kněžnou|7|178
00270407|Liboměřice|Chrudim|8|178
00244171|Nový Dům|Rakovník|1|178
00573655|Zhoř|Tachov|3|178
00581208|Břehov|České Budějovice|2|177
00377988|Krhov|Třebíč|9|177
00667005|Lom|Tábor|2|177
00600873|Zábeštní Lhota|Přerov|11|177
00373648|Boršov|Jihlava|9|176
00599336|Býšovec|Žďár nad Sázavou|9|176
00832235|Chudoslavice|Litoměřice|5|176
00233081|Kamberk|Benešov|1|176
00667722|Nebřehovice|Strakonice|2|176
00509787|Nesvačily|Beroun|1|176
00636525|Radotín|Přerov|11|176
00663026|Vrančice|Příbram|1|176
00673331|Všestudy|Chomutov|5|176
00600237|Boskovštejn|Znojmo|10|175
47256869|Buzice|Strakonice|2|175
00639826|Hvozd|Rakovník|1|175
00831395|Janův Důl|Liberec|6|175
00578371|Kacákova Lhota|Jičín|7|175
00248410|Koberovice|Pelhřimov|9|175
00373818|Meziříčko|Žďár nad Sázavou|9|175
00599646|Nyklovice|Žďár nad Sázavou|9|175
00378321|Pálovice|Třebíč|9|175
00636975|Rozkoš|Znojmo|10|175
00251828|Strašice|Strakonice|2|175
00673072|Velenice|Česká Lípa|6|175
00639761|Výžerky|Praha - východ|1|175
00578274|Bukvice|Jičín|7|174
00373681|Hladov|Jihlava|9|174
49056654|Horní Rápotice|Pelhřimov|9|174
00267651|Kojetín|Havlíčkův Brod|9|174
00573086|Kunějovice|Plzeň - sever|3|174
00378054|Lhánice|Třebíč|9|174
00273970|Mokošín|Pardubice|8|174
00583120|Pěčnov|Prachatice|2|174
00667943|Velká Turná|Strakonice|2|174
00637131|Výrovice|Znojmo|10|174
00512591|Dražičky|Tábor|2|173
60829257|Hajany|Strakonice|2|173
00572403|Hlohovčice|Domažlice|3|173
00377619|Klučov|Třebíč|9|173
00266507|Moldava v Krušných horách|Teplice|5|173
00876046|Oseček|Nymburk|1|173
00270113|Honbice|Chrudim|8|172
00251216|Hoslovice|Strakonice|2|172
00273716|Jedousov|Pardubice|8|172
00296104|Karlova Studánka|Bruntál|13|172
00578193|Libotov|Trutnov|7|172
00599808|Sejřek|Žďár nad Sázavou|9|172
00637025|Střelice|Znojmo|10|172
00599352|Daňkovice|Žďár nad Sázavou|9|171
00599492|Kněževes|Žďár nad Sázavou|9|171
00270377|Leštinka|Chrudim|8|171
00526410|Michalovice|Litoměřice|5|171
00840521|Míchov|Blansko|10|171
00580686|Neratov|Pardubice|8|171
00573698|Obora|Tachov|3|171
00580015|Ovesná Lhota|Havlíčkův Brod|9|171
00599735|Radkov|Žďár nad Sázavou|9|171
00580856|Vračovice-Orlov|Ústí nad Orlicí|8|171
00579475|Borušov|Svitavy|8|170
00640620|Černíky|Kolín|1|170
00583031|Chvalovice|Prachatice|2|170
49463942|Crhov|Blansko|10|170
18246036|Dražeň|Plzeň - sever|3|170
00272744|Jestřebí|Náchod|7|170
00286061|Kaliště|Jihlava|9|170
00636029|Krchleby|Šumperk|11|170
00635278|Lipina|Olomouc|11|170
47248955|Mezná|Pelhřimov|9|170
16981901|Račice|Rakovník|1|170
00232611|Rataje|Benešov|1|170
00635910|Rejchartice|Šumperk|11|170
00252875|Skopytce|Tábor|2|170
00250163|Tálín|Písek|2|170
00295736|Vidonín|Žďár nad Sázavou|9|170
00267261|Čachotín|Havlíčkův Brod|9|169
00662186|Dobřeň|Mělník|1|169
00509469|Kobylnice|Mladá Boleslav|1|169
00473723|Mrzky|Kolín|1|169
00511277|Ondřejov|Pelhřimov|9|169
00277223|Příluka|Svitavy|8|169
00378330|Pucov|Třebíč|9|169
00667111|Radkov|Tábor|2|169
00574236|Srby|Plzeň - jih|3|169
00579203|Svídnice|Rychnov nad Kněžnou|7|169
00671860|Žďárek|Liberec|6|169
00582476|Zhoř u Tábora|Tábor|2|169
00846546|Býkov-Láryšov|Bruntál|13|168
00662194|Lobeč|Mělník|1|168
00475475|Malšín|Český Krumlov|2|168
00373834|Mirošov|Jihlava|9|168
00883611|Poustka|Cheb|4|168
00599719|Radenice|Žďár nad Sázavou|9|168
00581054|Bílé Poličany|Trutnov|7|167
00512958|Dolní Žďár|Jindřichův Hradec|2|167
00573451|Dražovice|Klatovy|3|167
00640611|Hořany|Nymburk|1|167
00542873|Kulířov|Blansko|10|167
00365432|Skalička|Brno - venkov|10|167
62858297|Stínava|Prostějov|11|167
00279587|Sudslava|Ústí nad Orlicí|8|167
00580546|Tetov|Pardubice|8|167
18246109|Zahrádka|Plzeň - sever|3|167
60114525|Bačalky|Jičín|7|166
00581348|Hosty|České Budějovice|2|166
00270423|Lozice|Chrudim|8|166
00637297|Malá Lhota|Blansko|10|166
00544710|Malá Vrbka|Hodonín|10|166
00509761|Mořinka|Beroun|1|166
00509451|Nemyslovice|Mladá Boleslav|1|166
00236331|Pertoltice|Kutná Hora|1|166
00362484|Stupava|Uherské Hradiště|12|166
00640301|Bernardov|Kutná Hora|1|165
00600598|Holštejn|Blansko|10|165
00640352|Horušice|Kutná Hora|1|165
00637670|Milonice|Blansko|10|165
00481661|Vlastislav|Litoměřice|5|165
00511463|Zběšičky|Písek|2|165
00473537|Chmelná|Benešov|1|164
00480304|Čichalov|Karlovy Vary|4|164
00512567|Dlouhá Lhota|Tábor|2|164
00373699|Hojkov|Jihlava|9|164
00276863|Koruna|Svitavy|8|164
00666980|Krtov|Tábor|2|164
00075566|Kryštofovy Hamry|Chomutov|5|164
00636860|Medlice|Znojmo|10|164
00532185|Stvolová|Blansko|10|164
00268381|Trpišovice|Havlíčkův Brod|9|164
00498629|Bezděkov pod Třemšínem|Příbram|1|163
00581186|Borovnice|České Budějovice|2|163
00247871|Bratřice|Pelhřimov|9|163
00600261|Černín|Znojmo|10|163
00512656|Chrbonín|Tábor|2|163
04498691|Doupovské Hradiště|Karlovy Vary|4|163
00599468|Kadolec|Žďár nad Sázavou|9|163
00578410|Kozojedy|Jičín|7|163
00667595|Krašlovice|Strakonice|2|163
00636762|Krhov|Blansko|10|163
00580520|Lány u Dašic|Pardubice|8|163
00580007|Ostrov|Havlíčkův Brod|9|163
00373559|Podivice|Vyškov|10|163
00277240|Pustá Rybná|Svitavy|8|163
00579807|Břevnice|Havlíčkův Brod|9|162
43313914|Čímice|Klatovy|3|162
00636231|Grymov|Přerov|11|162
00583961|Horosedly|Písek|2|162
00667579|Kocelovice|Strakonice|2|162
00579921|Kyjov|Havlíčkův Brod|9|162
00508977|Lhotky|Mladá Boleslav|1|162
00378208|Naloučany|Třebíč|9|162
00556408|Podbořanský Rohozec|Louny|5|162
00378356|Pozďatín|Třebíč|9|162
00636487|Provodovice|Přerov|11|162
00529991|Šestajovice|Náchod|7|162
00277363|Slatina|Svitavy|8|162
00573124|Tatrovice|Sokolov|4|162
42634547|Třeštice|Jihlava|9|162
00599913|Věstín|Žďár nad Sázavou|9|162
00665649|Věžovatá Pláně|Český Krumlov|2|162
43420591|Závist|Blansko|10|162
00578266|Budčeves|Jičín|7|161
00876241|Husí Lhota|Mladá Boleslav|1|161
00579858|Jilem|Havlíčkův Brod|9|161
00258822|Kladruby|Rokycany|3|161
00378003|Kuroslepy|Třebíč|9|161
00636801|Labuty|Hodonín|10|161
00580562|Litošice|Pardubice|8|161
00636401|Nahošovice|Přerov|11|161
00378551|Radošov|Třebíč|9|161
00268160|Rušinov|Havlíčkův Brod|9|161
44444362|Zdechovice|Hradec Králové|7|161
00582964|Babice|Prachatice|2|160
00276715|Chotovice|Svitavy|8|160
00568589|Kelníky|Zlín|12|160
00269042|Lišice|Hradec Králové|7|160
00579963|Modlíkov|Havlíčkův Brod|9|160
00573612|Ošelín|Tachov|3|160
00662925|Ostrov|Příbram|1|160
00637491|Podmolí|Znojmo|10|160
00274143|Radhošť|Ústí nad Orlicí|8|160
00248991|Řečice|Pelhřimov|9|160
00244392|Skryje|Rakovník|1|160
00635634|Strukov|Olomouc|11|160
00274461|Týnišťko|Ústí nad Orlicí|8|160
00574333|Únětice|Plzeň - jih|3|160
00373966|Věžnice|Jihlava|9|160
00574015|Bezděkov|Rokycany|3|159
44065515|Dolní Lažany|Třebíč|9|159
00509388|Doubravička|Mladá Boleslav|1|159
00179591|Druhanov|Havlíčkův Brod|9|159
00263877|Levín|Litoměřice|5|159
00640492|Neprobylice|Kladno|1|159
00579637|Tržek|Svitavy|8|159
00481653|Chodovlice|Litoměřice|5|158
00509221|Kováň|Mladá Boleslav|1|158
00600466|Kyjovice|Znojmo|10|158
00579165|Polom|Rychnov nad Kněžnou|7|158
00478512|Sirá|Rokycany|3|158
00179779|Služátky|Havlíčkův Brod|9|158
00842435|Březejc|Žďár nad Sázavou|9|157
00599433|Chlumek|Žďár nad Sázavou|9|157
00512982|Frahelž|Jindřichův Hradec|2|157
00544574|Hoštice|Kroměříž|12|157
00572853|Kaceřov|Plzeň - sever|3|157
00600423|Korolupy|Znojmo|10|157
00656119|Malá Úpa|Trutnov|7|157
00599620|Nová Ves|Žďár nad Sázavou|9|157
00301841|Radíkov|Přerov|11|157
00279471|Seč|Ústí nad Orlicí|8|157
00639991|Šípy|Rakovník|1|157
00662798|Drahenice|Příbram|1|156
00573485|Hejná|Klatovy|3|156
00560031|Hodíškov|Žďár nad Sázavou|9|156
00477303|Kostelní Vydří|Jindřichův Hradec|2|156
00599522|Kuřimská Nová Ves|Brno - venkov|10|156
48527424|Lhotice|Třebíč|9|156
00580830|Loučky|Semily|6|156
00236357|Petrovice II|Kutná Hora|1|156
00531847|Radostín|Žďár nad Sázavou|9|156
00249025|Samšín|Pelhřimov|9|156
00526100|Černiv|Litoměřice|5|155
00666467|Klec|Jindřichův Hradec|2|155
00572331|Neuměř|Plzeň - jih|3|155
00489476|Sulkovec|Žďár nad Sázavou|9|155
00498521|Tupadly|Mělník|1|155
00572471|Úboč|Domažlice|3|155
00578649|Vrbice|Jičín|7|155
00635600|Bratříkovice|Opava|13|154
00666386|Halámky|Jindřichův Hradec|2|154
00639869|Kolešov|Rakovník|1|154
00583081|Mahouš|Prachatice|2|154
00498513|Medonosy|Mělník|1|154
00578533|Rokytňany|Jičín|7|154
00636819|Skalka|Hodonín|10|154
00640417|Starkoč|Kutná Hora|1|154
00578622|Tetín|Jičín|7|154
00244511|Třeboc|Rakovník|1|154
00253138|Vodice|Tábor|2|154
00579211|Vrbice|Rychnov nad Kněžnou|7|154
00637661|Zálesí|Znojmo|10|154
00373702|Hostětice|Jihlava|9|153
00556343|Lišany|Louny|5|153
00653390|Osičky|Hradec Králové|7|153
49209001|Podmokly|Klatovy|3|153
00378534|Radkovice u Budče|Třebíč|9|153
00667242|Vilice|Tábor|2|153
00509418|Vrátno|Mladá Boleslav|1|153
00673293|Všehrdy|Chomutov|5|153
00485659|České Petrovice|Ústí nad Orlicí|8|152
00639834|Janov|Rakovník|1|152
00635502|Mladecko|Opava|13|152
00580635|Podůlšany|Pardubice|8|152
43313957|Prášily|Klatovy|3|152
00636576|Sobíšky|Přerov|11|152
00640093|Souňov|Kutná Hora|1|152
00287792|Sulimov|Kroměříž|12|152
00636266|Horní Těšice|Přerov|11|151
00636291|Kladníky|Přerov|11|151
00831522|Kozly|Česká Lípa|6|151
00574066|Líšina|Plzeň - jih|3|151
00268089|Prosíčka|Havlíčkův Brod|9|151
00831620|Slunečná|Česká Lípa|6|151
00662780|Cetyně|Příbram|1|150
00581313|Hlavatce|České Budějovice|2|150
00373451|Malínky|Vyškov|10|150
00262030|Měděnec|Chomutov|5|150
00599824|Skřinářov|Žďár nad Sázavou|9|150
00582433|Skrýchov u Malšic|Tábor|2|150
00512516|Balkova Lhota|Tábor|2|149
00376094|Bochovice|Třebíč|9|149
00512583|Drahov|Tábor|2|149
00662224|Kadlín, okres Mělník|Mělník|1|149
00637394|Kadov|Znojmo|10|149
00270326|Krásné|Chrudim|8|149
00572632|Nová Ves|Domažlice|3|149
00250643|Radhostice|Prachatice|2|149
00574091|Střelice|Plzeň - jih|3|149
00636673|Strhaře|Brno - venkov|10|149
00373974|Věžnička|Jihlava|9|149
00599956|Zadní Zhořec|Žďár nad Sázavou|9|149
00377309|Chlum|Třebíč|9|148
00579513|Horky|Svitavy|8|148
00599476|Kadov|Žďár nad Sázavou|9|148
00257915|Kopidlo|Plzeň - sever|3|148
00572420|Křenovy|Domažlice|3|148
00511684|Osek|Písek|2|148
00653365|Račice nad Trotinou|Hradec Králové|7|148
00662976|Starosedlský Hrádek|Příbram|1|148
00279579|Sudislav nad Orlicí|Ústí nad Orlicí|8|148
00578720|Hořenice|Náchod|7|147
00473545|Javorník|Benešov|1|147
00578401|Kovač|Jičín|7|147
00242560|Křešín|Příbram|1|147
00509736|Lužce|Beroun|1|147
00667781|Přechovice|Strakonice|2|147
00636517|Radkovy|Přerov|11|147
00667846|Slaník|Strakonice|2|147
00511994|Vlksice|Písek|2|147
00273210|Vršovka|Náchod|7|147
00249408|Vyklantice|Pelhřimov|9|147
00572594|Ždánov|Domažlice|3|147
00580864|Zdobín|Trutnov|7|147
00179639|Chřenovice|Havlíčkův Brod|9|146
00580872|OBEC ZÁBŘEZÍ-ŘEČICE|Trutnov|7|146
00574317|Otěšice|Plzeň - jih|3|146
00508489|Psáře|Benešov|1|146
00599182|Vlčatín|Třebíč|9|146
00509361|Ctiměřice|Mladá Boleslav|1|145
00251232|Hoštice|Strakonice|2|145
00257877|Jarov|Plzeň - sever|3|145
00580031|Podmoky|Havlíčkův Brod|9|145
00264318|Rochov|Litoměřice|5|145
00249041|Sedlice|Pelhřimov|9|145
00599972|Újezd u Tišnova|Brno - venkov|10|145
00380857|Zástřizly|Kroměříž|12|145
00373630|Bohuslavice|Jihlava|9|144
00662836|Hlubyně|Příbram|1|144
00639885|Krakov|Rakovník|1|144
00373826|Milíčov|Jihlava|9|144
00842311|Račín|Žďár nad Sázavou|9|144
00580040|Radostín|Havlíčkův Brod|9|144
00875503|Stradonice|Kladno|1|144
00511714|Cerhonice|Písek|2|143
00376825|Dědice|Třebíč|9|143
00373711|Hubenov|Jihlava|9|143
00375349|Křižanovice u Vyškova|Vyškov|10|143
00573329|Mokrosuky|Klatovy|3|143
00854000|Nasavrky|Ústí nad Orlicí|8|143
00542881|Rozsíčka|Blansko|10|143
00253707|Rybník|Domažlice|3|143
00663042|Zbenice|Příbram|1|143
00292494|Bítov|Znojmo|10|142
00376965|Horní Heřmanice|Třebíč|9|142
00270148|Hošťalovice|Chrudim|8|142
00583324|Lčovice|Prachatice|2|142
00654019|Mezilečí|Náchod|7|142
00572667|Ovesné Kladruby|Cheb|4|142
00373885|Panské Dubenky|Jihlava|9|142
00583987|Přeborov|Písek|2|142
00274216|Selmice|Pardubice|8|142
00509817|Skřipel|Beroun|1|142
00579157|Sněžné|Rychnov nad Kněžnou|7|142
00269590|Stará Voda|Hradec Králové|7|142
00476749|Věžná|Pelhřimov|9|142
00640531|Zájezd|Kladno|1|142
15054233|Žlebské Chvalovice|Chrudim|8|142
00512273|Černov|Pelhřimov|9|141
00572322|Černovice|Plzeň - jih|3|141
00511323|Čížkov|Pelhřimov|9|141
00601144|Hraničné Petrovice|Olomouc|11|141
00581399|Hvozdec|České Budějovice|2|141
15054250|Kněžice|Chrudim|8|141
00662861|Korkyně|Příbram|1|141
00667013|Mažice|Tábor|2|141
00599590|Mirošov|Žďár nad Sázavou|9|141
00236420|Slavošov|Kutná Hora|1|141
00666921|Světce|Jindřichův Hradec|2|141
00572811|Tuřany|Cheb|4|141
00663034|Vševily|Příbram|1|141
00276499|Březiny|Svitavy|8|140
00600059|Polomí|Prostějov|11|140
00875791|Strojetice|Benešov|1|140
00511218|Bystrá|Pelhřimov|9|139
00581241|Dobšice|České Budějovice|2|139
00574104|Lisov|Plzeň - jih|3|139
00640425|Loucká|Kladno|1|139
00578479|Ohaveč|Jičín|7|139
00268011|Pavlov|Havlíčkův Brod|9|139
00576123|Petrovice|Bruntál|13|139
00599697|Pokojov|Žďár nad Sázavou|9|139
00637033|Šafov|Znojmo|10|139
00853135|Stavenice|Šumperk|11|139
00640409|Štipoklasy|Kutná Hora|1|139
00875830|Újezdec|Mělník|1|139
00840637|Velké Janovice|Žďár nad Sázavou|9|139
00599344|Černvír|Brno - venkov|10|138
00580511|Malé Výkleky|Pardubice|8|138
45978671|Radostov|Hradec Králové|7|138
00580082|Slavětín|Havlíčkův Brod|9|138
15054209|Smrček|Chrudim|8|138
00556904|Tašov|Ústí nad Labem|5|138
00600652|Dlouhá Lhota|Blansko|10|137
00599379|Dolní Libochová|Žďár nad Sázavou|9|137
42634679|Dyjice|Jihlava|9|137
47786671|Kozly|Louny|5|137
00581593|Kvítkovice|České Budějovice|2|137
00277304|Rudná|Svitavy|8|137
00574244|Sedliště|Plzeň - jih|3|137
00272281|Úhlejov|Jičín|7|137
00271209|Všeradov|Chrudim|8|137
00599191|Zahrádka|Třebíč|9|137
00600300|Dolenice|Znojmo|10|136
00640441|Hořešovičky|Kladno|1|136
00583472|Krasíkovice|Pelhřimov|9|136
48527441|Menhartice|Třebíč|9|136
00511986|Olešná|Písek|2|136
00378348|Přešovice|Třebíč|9|136
00639664|Adamov|Kutná Hora|1|135
00573680|Broumov|Tachov|3|135
00600334|Džbánice|Znojmo|10|135
00582492|Hlasivo|Tábor|2|135
00666424|Horní Slatina|Jindřichův Hradec|2|135
00511471|Jickovice|Písek|2|135
00832081|Lukov|Teplice|5|135
00362476|Staré Hutě|Uherské Hradiště|12|135
00272256|Tuř|Jičín|7|135
00842401|Baliny|Žďár nad Sázavou|9|134
00496987|Bor u Skutče|Chrudim|8|134
00578240|Březina|Jičín|7|134
00276707|Chotěnov|Svitavy|8|134
47695943|Drahoňův Újezd|Rokycany|3|134
00512621|Hodonice|Tábor|2|134
00377759|Kozlany|Třebíč|9|134
00572489|Němčice|Domažlice|3|134
00511757|Nevězice|Písek|2|134
00378305|Oslavička|Žďár nad Sázavou|9|134
00378488|Petrůvky|Třebíč|9|134
00572535|Úsilov|Domažlice|3|134
00599255|Zašovice|Třebíč|9|134
00583154|Želnava|Prachatice|2|134
00573566|Chlistov|Klatovy|3|133
00574171|Drahkov|Plzeň - jih|3|133
00666432|Jilem|Jindřichův Hradec|2|133
00573558|Kvášňovice|Klatovy|3|133
00600628|Lhota u Lysic|Blansko|10|133
44065493|Lomy|Třebíč|9|133
42634598|Mysletice|Jihlava|9|133
00640107|Třebonín|Kutná Hora|1|133
00573701|Únehle|Tachov|3|133
00525537|Vlastiboř|Jablonec nad Nisou|6|133
43313868|Biřkov|Klatovy|3|132
00532134|Osiky|Brno - venkov|10|132
00580023|Podmoklany|Havlíčkův Brod|9|132
47733390|Potvorov|Plzeň - sever|3|132
00378631|Studnice|Třebíč|9|132
00512052|Temešvár|Písek|2|132
00271144|Vinary|Ústí nad Orlicí|8|132
00231541|Čakov|Benešov|1|131
00872059|Chodov|Karlovy Vary|4|131
00263508|Dlažkovice|Litoměřice|5|131
00498599|Dobrovítov|Kutná Hora|1|131
00665126|Klášterní Skalice|Kolín|1|131
00377970|Kramolín|Třebíč|9|131
00243990|Lašovice|Rakovník|1|131
00572616|Libkov|Domažlice|3|131
00637556|Litostrov|Brno - venkov|10|131
00572918|Lochousice|Plzeň - sever|3|131
00249017|Salačova Lhota|Pelhřimov|9|131
43500081|Úherčice|Chrudim|8|131
00599204|Zárubice|Třebíč|9|131
00572306|Bukovec|Plzeň - jih|3|130
00636185|Čelechovice|Přerov|11|130
46684468|Droužetice|Strakonice|2|130
00572837|Kbelany|Plzeň - sever|3|130
46684484|Kladruby|Strakonice|2|130
00572926|Nadryby|Plzeň - sever|3|130
00578568|Slavhostice|Jičín|7|130
00509159|Strážiště|Mladá Boleslav|1|130
00667854|Strunkovice nad Volyňkou|Strakonice|2|130
00250767|Tvrzice|Prachatice|2|130
43313825|Zborovy|Klatovy|3|130
00274887|Dobřany|Rychnov nad Kněžnou|7|129
00280801|Petrov|Blansko|10|129
00296309|Rusín|Bruntál|13|129
48895636|Skorotice|Žďár nad Sázavou|9|129
00842664|Vlachovice|Žďár nad Sázavou|9|129
00476421|Březina|Jindřichův Hradec|2|128
00582441|Dolní Hrachovice|Tábor|2|128
00512681|Komárov|Tábor|2|128
00378127|Loukovice|Třebíč|9|128
00270563|Nabočany|Chrudim|8|128
00635529|Staré Těchanovice|Opava|13|128
00662313|Vidim|Mělník|1|128
00266175|Volevčice|Most|5|128
00288047|Bousín|Prostějov|11|127
44626754|Čmelíny|Plzeň - jih|3|127
00640328|Dolní Pohleď|Kutná Hora|1|127
00532126|Horní Smržov|Blansko|10|127
00267708|Krátká Ves|Havlíčkův Brod|9|127
00667609|Krty-Hradec|Strakonice|2|127
00653349|Lužany|Hradec Králové|7|127
00244287|Pustověty|Rakovník|1|127
00876259|Sezemice|Mladá Boleslav|1|127
00599859|Strachujov|Žďár nad Sázavou|9|127
00640034|Žďár|Rakovník|1|127
00583952|Žďár|Jindřichův Hradec|2|127
00581283|Habří|České Budějovice|2|126
00580473|Poběžovice u Přelouče|Pardubice|8|126
00532177|Skrchov|Blansko|10|126
00667153|Slapsko|Tábor|2|126
44065507|Stropešín|Třebíč|9|126
00274534|Vápno|Pardubice|8|126
15060918|Ždírec|Havlíčkův Brod|9|126
00572977|Bohy|Plzeň - sever|3|125
00285722|Černíč|Jihlava|9|125
00269964|Dědová|Chrudim|8|125
00542865|Kozárov|Blansko|10|125
00573442|Myslovice|Klatovy|3|125
00667749|Němětice|Strakonice|2|125
00508349|Tomice|Benešov|1|125
00366005|Úsuší|Brno - venkov|10|125
00276413|Bohuňov|Svitavy|8|124
00376078|Bohušice|Třebíč|9|124
47733454|Hněvnice|Plzeň - sever|3|124
00473472|Ješetice|Benešov|1|124
00639851|Karlova Ves|Rakovník|1|124
00639907|Krty|Rakovník|1|124
00378119|Litovany|Třebíč|9|124
43313850|Lomec|Klatovy|3|124
00194646|Radkov|Svitavy|8|124
00373907|Rybné|Jihlava|9|124
00509060|Veselice|Mladá Boleslav|1|124
00373982|Vystrčenovice|Jihlava|9|124
00267236|Borek|Havlíčkův Brod|9|123
00639788|Břežany|Rakovník|1|123
00579432|Březinky|Svitavy|8|123
00269956|České Lhotice|Chrudim|8|123
00473529|Chlum|Benešov|1|123
00512648|Chotěmice|Tábor|2|123
00373737|Ježená|Jihlava|9|123
00373753|Kalhov|Jihlava|9|123
00509671|Korno|Beroun|1|123
00572845|Koryta|Plzeň - sever|3|123
00497002|Křižanovice|Chrudim|8|123
00250511|Kvilda|Prachatice|2|123
00276901|Lavičné|Svitavy|8|123
00512800|Nová Olešná|Jindřichův Hradec|2|123
00515922|Pavlov|Pelhřimov|9|123
00573841|Plískov|Rokycany|3|123
00378518|Rácovice|Třebíč|9|123
00286788|Urbanov|Jihlava|9|123
00578665|Zámostí - Blata|Jičín|7|123
00374083|Zbinohy|Jihlava|9|123
00653306|Benátky|Hradec Králové|7|122
00583448|Chyšná|Pelhřimov|9|122
00599484|Karlov|Žďár nad Sázavou|9|122
00666998|Libějice|Tábor|2|122
00573311|Mezholezy|Domažlice|3|122
00253561|Mezholezy|Domažlice|3|122
00556351|Nová Ves|Louny|5|122
00599727|Radešín|Žďár nad Sázavou|9|122
43313817|Újezd u Plánice|Klatovy|3|122
00572764|Vlkovice|Cheb|4|122
00666581|Vydří|Jindřichův Hradec|2|122
00673463|Ždírec|Česká Lípa|6|122
00509108|Bílá Hlína|Mladá Boleslav|1|121
00515949|Dehtáře|Pelhřimov|9|121
00377724|Komárovice|Třebíč|9|121
00599506|Krásné|Žďár nad Sázavou|9|121
00378038|Lesní Jakubov|Třebíč|9|121
00509752|Málkov|Beroun|1|121
00583511|Nová Buková|Pelhřimov|9|121
00532169|Roubanina|Blansko|10|121
00580660|Sovolusky|Pardubice|8|121
00275654|Bystrá nad Jizerou|Semily|6|120
00582484|Krátošice|Tábor|2|120
00252565|Mlýny|Tábor|2|120
00267929|Nová Ves u Leštiny|Havlíčkův Brod|9|120
00868833|Skapce|Tachov|3|120
47919761|Vincencov|Prostějov|11|120
00572233|Vlkanov|Domažlice|3|120
00556319|Chraberce|Louny|5|119
00267546|Chrtníč|Havlíčkův Brod|9|119
42716870|Koryta|Mladá Boleslav|1|119
00498637|Koupě|Příbram|1|119
00667625|Kváskovice|Strakonice|2|119
00511480|Květov|Písek|2|119
18246079|Štichovice|Plzeň - sever|3|119
00875805|Stranný|Benešov|1|119
00673081|Vrchovany|Česká Lípa|6|119
00578215|Bílsko|Jičín|7|118
00672114|Cetenov|Liberec|6|118
00637408|Křepice|Znojmo|10|118
00572624|Loučim|Domažlice|3|118
00666505|Ponědraž|Jindřichův Hradec|2|118
00580538|Pravy|Pardubice|8|118
45978794|Puchlovice|Hradec Králové|7|118
00579149|Říčky v Orlických horách|Rychnov nad Kněžnou|7|118
00599875|Sviny|Žďár nad Sázavou|9|118
00532193|Synalov|Brno - venkov|10|118
00579645|Újezdec|Svitavy|8|118
00654663|Zájezdec|Chrudim|8|118
00512923|Bednárec|Jindřichův Hradec|2|117
43313809|Hamry|Klatovy|3|117
00666441|Kačlehy|Jindřichův Hradec|2|117
00509396|Kovanec|Mladá Boleslav|1|117
00579904|Kraborovice|Havlíčkův Brod|9|117
00248509|Leskovice|Pelhřimov|9|117
00556386|Opočno|Louny|5|117
00509311|Přepeře|Mladá Boleslav|1|117
00378569|Rohy|Třebíč|9|117
00573060|Újezd nade Mží|Plzeň - sever|3|117
00377597|Kdousov|Třebíč|9|116
18246044|Kočín|Plzeň - sever|3|116
04498712|Luboměř pod Strážnou|Přerov|11|116
00476455|Mysletín|Pelhřimov|9|116
00578550|Sekeřice|Jičín|7|116
00667927|Uzeničky|Strakonice|2|116
00473383|Všechlapy|Benešov|1|116
00673099|Blatce|Česká Lípa|6|115
00274925|Janov|Rychnov nad Kněžnou|7|115
00639702|Oplany|Praha - východ|1|115
00573949|Ostrovec-Lhotka|Rokycany|3|115
00378461|Pokojovice|Třebíč|9|115
00515825|Svépravice|Pelhřimov|9|115
44626614|Třebčice|Plzeň - jih|3|115
00583413|Žárovná|Prachatice|2|115
00639842|Kalivody|Rakovník|1|114
00584088|Lhota-Vlasenice|Pelhřimov|9|114
00256889|Louňová|Plzeň - jih|3|114
00665151|Masojedy|Kolín|1|114
00256943|Míšov|Plzeň - jih|3|114
00600580|Ochoz u Tišnova|Brno - venkov|10|114
00662992|Svojšice|Příbram|1|114
00640247|Třebětín|Kutná Hora|1|114
00637041|Trnové Pole|Znojmo|10|114
00579777|Bačkov|Havlíčkův Brod|9|113
00572527|Chocomyšl|Domažlice|3|113
00580465|Chrtníky|Pardubice|8|113
00512575|Dobronice u Bechyně|Tábor|2|113
00579912|Kunemil|Havlíčkův Brod|9|113
00575968|Malá Štáhle|Bruntál|13|113
00509744|Malá Víska|Beroun|1|113
00640751|Okoř|Praha - západ|1|113
00276090|Roztoky u Semil|Semily|6|113
00473375|Třebešice|Benešov|1|113
00509264|Ujkovice|Mladá Boleslav|1|113
44065523|Valdíkov|Třebíč|9|113
00640310|Brambory|Kutná Hora|1|112
00375331|Drahonín|Brno - venkov|10|112
00600016|Hačky|Prostějov|11|112
00581356|Hradce|České Budějovice|2|112
00667633|Lažánky|Strakonice|2|112
00667676|Lom|Strakonice|2|112
00667030|Mezná|Tábor|2|112
00667099|Psárov|Tábor|2|112
00574210|Radkovice|Plzeň - jih|3|112
00600075|Rakůvka|Prostějov|11|112
00654086|Sendraž|Náchod|7|112
00511251|Útěchovice pod Stražištěm|Pelhřimov|9|112
00274640|Žáravice|Pardubice|8|112
00276421|Bohuňovice|Svitavy|8|111
00476439|Bořetín|Pelhřimov|9|111
00473707|Dománovice|Kolín|1|111
00508446|Drahňovice|Benešov|1|111
00377261|Hroznatín|Třebíč|9|111
00640514|Líský|Kladno|1|111
48527475|Radotice|Třebíč|9|111
00269689|Šaplava|Hradec Králové|7|111
00637572|Stálky|Znojmo|10|111
00378712|Štěpkov|Třebíč|9|111
00277479|Študlov|Svitavy|8|111
18244122|Trokavec|Rokycany|3|111
00512770|Záhoří|Jindřichův Hradec|2|111
00599310|Borovník|Brno - venkov|10|110
00665673|Chlumec|Český Krumlov|2|110
00581330|Horní Kněžeklady|České Budějovice|2|110
00666408|Horní Meziříčko|Jindřichův Hradec|2|110
00640069|Hraběšín|Kutná Hora|1|110
00372498|Kožušice|Vyškov|10|110
00256811|Kramolín|Plzeň - jih|3|110
00509710|Lážovice|Beroun|1|110
00636428|Oldřichov|Přerov|11|110
00666947|Pístina|Jindřichův Hradec|2|110
00583529|Polesí|Pelhřimov|9|110
00840645|Rodkov|Žďár nad Sázavou|9|110
00666939|Smržov|Jindřichův Hradec|2|110
00511510|Střítež|Pelhřimov|9|110
00279714|Vlčkov|Svitavy|8|110
00473774|Zalešany|Kolín|1|110
00374237|Žatec|Jihlava|9|110
00584070|Zhořec|Pelhřimov|9|110
18243649|Kakejcov|Rokycany|3|109
00267627|Klokočov|Havlíčkův Brod|9|109
00600521|Kotlasy|Žďár nad Sázavou|9|109
00640506|Kutrovice|Kladno|1|109
00654027|Litoboř|Náchod|7|109
00667731|Němčice|Strakonice|2|109
00637564|Podmyče|Znojmo|10|109
00511358|Dobrá Voda u Pacova|Pelhřimov|9|108
00377287|Hvězdoňovice|Třebíč|9|108
00662232|Kanina|Mělník|1|108
00573515|Klenová|Klatovy|3|108
00581771|Mokrý Lom|České Budějovice|2|108
00572268|Otov|Domažlice|3|108
47733403|Sedlec|Plzeň - sever|3|108
00583545|Stojčín|Pelhřimov|9|108
00573116|Tis u Blatna|Plzeň - sever|3|108
00579220|Vysoký Újezd|Hradec Králové|7|108
00247952|Čáslavsko|Pelhřimov|9|107
00265870|Český Jiřetín|Most|5|107
00600393|Chvalatice|Znojmo|10|107
43313949|Frymburk|Klatovy|3|107
00637734|Hluboké Dvory|Brno - venkov|10|107
00579190|Krchleby|Rychnov nad Kněžnou|7|107
00876232|Krychnov|Kolín|1|107
00573418|Modrava|Klatovy|3|107
46810161|Tojice|Plzeň - jih|3|107
00572462|Únějovice|Domažlice|3|107
00667307|Zhoř u Mladé Vožice|Tábor|2|107
00581178|Bečice|České Budějovice|2|106
47730862|Dobršín|Klatovy|3|106
00574112|Nezdřev|Plzeň - jih|3|106
00251640|Paračov|Strakonice|2|106
00636941|Prokopov|Znojmo|10|106
00578517|Rašín|Jičín|7|106
00279552|Strážná|Ústí nad Orlicí|8|106
00232785|Studený|Benešov|1|106
00640026|Všesulov|Rakovník|1|106
42634695|Doupě|Jihlava|9|105
00639915|Malinová|Rakovník|1|105
00875872|Modřovice|Příbram|1|105
00511731|Nerestce|Písek|2|105
46687726|Nová Ves|Strakonice|2|105
00526070|Oleško|Litoměřice|5|105
00666491|Polště|Jindřichův Hradec|2|105
00842354|Sklené|Žďár nad Sázavou|9|105
00512915|Báňovice|Jindřichův Hradec|2|104
00377325|Chotěbudice|Třebíč|9|104
00842141|Cikháj|Žďár nad Sázavou|9|104
00662305|Dolní Zimoř|Mělník|1|104
00599441|Javorek|Žďár nad Sázavou|9|104
00267741|Kynice|Havlíčkův Brod|9|104
00248631|Mezilesí|Pelhřimov|9|104
00599166|Třesov|Třebíč|9|104
00509868|Vinařice|Beroun|1|104
00667251|Vlčeves|Tábor|2|104
00473413|Vodslivy|Benešov|1|104
00572365|Všekary|Plzeň - jih|3|104
00600253|Čermákovice|Znojmo|10|103
00574325|Chlumy|Plzeň - jih|3|103
00576069|Dlouhá Stráň|Bruntál|13|103
00666971|Košín|Tábor|2|103
00194557|Malíkov|Svitavy|8|103
00667081|Pojbuky|Tábor|2|103
00572799|Prameny|Cheb|4|103
00639974|Řeřichy|Rakovník|1|103
00636983|Rudlice|Znojmo|10|103
00249394|Vojslavice|Pelhřimov|9|103
00578657|Vřesník|Jičín|7|103
00473456|Blažejovice|Benešov|1|102
00580341|Bošín|Ústí nad Orlicí|8|102
00248151|Hojanovice|Pelhřimov|9|102
00581763|Modrá Hůrka|České Budějovice|2|102
00373532|Nové Sady|Vyškov|10|102
00580627|Plch|Pardubice|8|102
00636959|Přeskače|Znojmo|10|102
00599760|Rousměrov|Žďár nad Sázavou|9|102
00509175|Sudoměř|Mladá Boleslav|1|102
00573299|Teplička|Karlovy Vary|4|102
00599883|Tišnovská Nová Ves|Brno - venkov|10|102
00842214|Tři Studně|Žďár nad Sázavou|9|102
00251968|Uzenice|Strakonice|2|102
00512761|Záblatí|Jindřichův Hradec|2|102
00512257|Bořetice|Pelhřimov|9|101
00572314|Čečovice|Plzeň - jih|3|101
00574295|Kozlovice|Plzeň - jih|3|101
00637301|Lubě|Blansko|10|101
00578495|Ostružno|Jičín|7|101
00276049|Rakousy|Semily|6|101
00599867|Střítež|Žďár nad Sázavou|9|101
00556459|Úherce|Louny|5|101
00580945|Hrádek|Ústí nad Orlicí|8|100
00377279|Hrutov|Jihlava|9|100
00579297|Jahodov|Rychnov nad Kněžnou|7|100
00573523|Kejnice|Klatovy|3|100
00583316|Nové Hutě|Prachatice|2|100
00378283|Okarec|Třebíč|9|100
00842532|Osové|Žďár nad Sázavou|9|100
00580066|Skorkov|Havlíčkův Brod|9|100
00663018|Tušovice|Příbram|1|100
00599409|Horní Radslavice|Žďár nad Sázavou|9|99
00378259|Nový Telečkov|Třebíč|9|99
00599689|Podolí|Žďár nad Sázavou|9|99
00599743|Radňoves|Žďár nad Sázavou|9|99
00582468|Řemíčov|Tábor|2|99
00512753|Višňová|Jindřichův Hradec|2|99
00578673|Židovice|Jičín|7|99
00512931|Bořetín|Jindřichův Hradec|2|98
00376396|Brtnička|Jihlava|9|98
00876224|Grunta|Kolín|1|98
00275727|Holenice|Semily|6|98
00832294|Horní Řepčice|Litoměřice|5|98
00673480|Luka|Česká Lípa|6|98
00637726|Bukovice|Brno - venkov|10|97
00373656|Dolní Vilímeč|Jihlava|9|97
47274212|Doubice|Děčín|5|97
00378020|Lesná|Třebíč|9|97
00373800|Lhotka|Jihlava|9|97
00842451|Velké Tresné|Žďár nad Sázavou|9|97
00578223|Borek|Jičín|7|96
00574139|Borovno|Plzeň - jih|3|96
00583006|Drslavice|Prachatice|2|96
00667587|Krajníčko|Strakonice|2|96
00583057|Kubova Huť|Prachatice|2|96
00580678|Morašice|Pardubice|8|96
00579971|Nejepín|Havlíčkův Brod|9|96
00662933|Počaply|Příbram|1|96
00639729|Prusice|Praha - východ|1|96
43313906|Slatina|Klatovy|3|96
00574058|Vlčtejn|Plzeň - jih|3|96
00239917|Vlkov pod Oškobrhem|Nymburk|1|96
47786647|Zálužice|Louny|5|96
00665681|Zvíkov|Český Krumlov|2|96
00662771|Bukovany|Příbram|1|95
00572934|Hlince|Plzeň - sever|3|95
00477125|Hlupín|Strakonice|2|95
00583979|Myslín|Písek|2|95
00578606|Svatojanský Újezd|Jičín|7|95
00278351|Trotina|Trutnov|7|95
47786655|Želkovice|Louny|5|95
00512231|Bácovice|Pelhřimov|9|94
60418541|Cidlina|Třebíč|9|94
00476188|Křižanov|Písek|2|94
00667790|Přední Zborovice|Strakonice|2|94
00582450|Rodná|Tábor|2|94
00578541|Sedliště|Jičín|7|94
00583014|Dvory|Prachatice|2|93
00512630|Hodětín|Tábor|2|93
00579947|Leškovice|Havlíčkův Brod|9|93
00667765|Pivkovice|Strakonice|2|93
00578576|Soběraz|Jičín|7|93
47248971|Čelistná|Pelhřimov|9|92
00525499|Janovice v Podještědí|Liberec|6|92
00373745|Jindřichovice|Jihlava|9|92
00377716|Kojatín|Třebíč|9|92
00667056|Nasavrky|Tábor|2|92
00473430|Borovnice|Benešov|1|91
00832138|Brzánky|Litoměřice|5|91
00583332|Budkov|Prachatice|2|91
42634580|Horní Myslová|Jihlava|9|91
00286141|Kostelní Myslová|Jihlava|9|91
00509141|Mohelnice nad Jizerou|Mladá Boleslav|1|91
00515973|Proseč pod Křemešníkem|Pelhřimov|9|91
00639681|Schořov|Kutná Hora|1|91
47733381|Bílov|Plzeň - sever|3|90
00579815|Čečkovice|Havlíčkův Brod|9|90
00477010|Heřmaneč|Jindřichův Hradec|2|90
00579572|Kukle|Svitavy|8|90
00639931|Nezabudice|Rakovník|1|90
00378275|Odunec|Třebíč|9|90
00509442|Pětikozly|Mladá Boleslav|1|90
00545660|Radonín|Třebíč|9|90
00599778|Rozseč|Žďár nad Sázavou|9|90
47367407|Strachoňovice|Jihlava|9|90
00667901|Úlehle|Strakonice|2|90
00512044|Vojníkov|Písek|2|90
00279781|Zádolí|Ústí nad Orlicí|8|90
00580147|Zvěstovice|Havlíčkův Brod|9|90
00234575|Kvílice|Kladno|1|89
00583499|Litohošť|Pelhřimov|9|89
00373877|Otín|Jihlava|9|89
00473448|Snět|Benešov|1|89
47367105|Švábov|Jihlava|9|89
00637645|Újezd|Znojmo|10|89
00599930|Vratislávka|Brno - venkov|10|89
00637149|Vysočany|Znojmo|10|89
00515914|Žirov|Pelhřimov|9|89
48527408|Bačkovice|Třebíč|9|88
00572829|Černíkovice|Plzeň - sever|3|88
00578428|Kyje|Jičín|7|88
00637467|Němčičky|Znojmo|10|88
00582051|Stehlovice|Písek|2|88
00239259|Kolaje|Nymburk|1|87
00639940|Přerubenice|Rakovník|1|87
00378526|Račice|Třebíč|9|87
00543748|Řídelov|Jihlava|9|87
49208993|Tužice|Klatovy|3|87
00831778|Brodec|Louny|5|86
00273414|Bukovina u Přelouče|Pardubice|8|86
00573493|Hnačov|Klatovy|3|86
00662844|Horčápsko|Příbram|1|86
00599417|Horní Rožínka|Žďár nad Sázavou|9|86
00639877|Kozojedy|Rakovník|1|86
00583308|Křišťanov|Prachatice|2|86
00270393|Libkov|Chrudim|8|86
43313884|Nehodiv|Klatovy|3|86
00509051|Řitonice|Mladá Boleslav|1|86
00580996|Trpík|Ústí nad Orlicí|8|86
00475858|Arneštovice|Pelhřimov|9|85
00479713|Bujesily|Rokycany|3|85
00583430|Hojovice|Pelhřimov|9|85
00666416|Horní Němčice|Jindřichův Hradec|2|85
00267562|Jedlá|Havlíčkův Brod|9|85
00378178|Meziříčko|Třebíč|9|85
00842249|Milešín|Žďár nad Sázavou|9|85
00583405|Nicov|Prachatice|2|85
00636452|Oprostovice|Přerov|11|85
00509272|Prodašice|Mladá Boleslav|1|85
00572373|Štichov|Plzeň - jih|3|85
00578827|Vrchovnice|Hradec Králové|7|85
42634555|Borovná|Jihlava|9|84
00473553|Kuňovice|Benešov|1|84
00667650|Libětice|Strakonice|2|84
00599751|Rojetín|Brno - venkov|10|84
00543586|Ubušínek|Žďár nad Sázavou|9|84
42634539|Vanov|Jihlava|9|84
43313876|Kovčín|Klatovy|3|83
18243673|Mešno|Rokycany|3|83
00572161|Pelechy|Domažlice|3|83
00274127|Přepychy|Pardubice|8|83
42634709|Zvolenovice|Jihlava|9|83
00837288|Haluzice|Zlín|12|82
00654736|Hodonín|Chrudim|8|82
00377571|Jiratice|Třebíč|9|82
00477443|Kalenice|Strakonice|2|82
00640522|Libochovičky|Kladno|1|82
00578461|Ohařice|Jičín|7|82
00373851|Olšany|Jihlava|9|82
00640051|Šebestěnice|Kutná Hora|1|82
00639982|Smilovice|Rakovník|1|82
00640271|Sudějov|Kutná Hora|1|82
00573973|Chomle|Rokycany|3|81
00579823|Dolní Sokolovec|Havlíčkův Brod|9|81
00573531|Javor|Klatovy|3|81
00573728|Olbramov|Tachov|3|81
00511234|Staré Bříště|Pelhřimov|9|81
00583138|Újezdec|Prachatice|2|81
00512559|Černýšovice|Tábor|2|80
49056620|Dubovice|Pelhřimov|9|80
47930276|Honětice|Kroměříž|12|80
00512796|Hrachoviště|Jindřichův Hradec|2|80
00573965|Kamenec|Rokycany|3|80
00378046|Lesůňky|Třebíč|9|80
00252671|Pohnání|Tábor|2|80
00666513|Ponědrážka|Jindřichův Hradec|2|80
00277436|Suchá Lhota|Svitavy|8|80
00276201|Troskovice|Semily|6|80
00574279|Vlčí|Plzeň - jih|3|80
00636703|Žerůtky|Blansko|10|80
00663051|Županovice|Příbram|1|80
00512524|Bečice|Tábor|2|79
00600130|Blanné|Znojmo|10|79
00639818|Hracholusky|Rakovník|1|79
00476137|Píšť|Pelhřimov|9|79
47016035|Drahouš|Rakovník|1|78
00666459|Kamenný Malíkov|Jindřichův Hradec|2|78
00544582|Kunkovice|Kroměříž|12|78
00572578|Močerady|Domažlice|3|78
00573914|Sebečice|Rokycany|3|78
00640000|Švihov|Rakovník|1|78
00637319|Tasovice|Blansko|10|78
00376990|Horní Vilémovice|Třebíč|9|77
00509167|Neveklovice|Mladá Boleslav|1|77
00636894|Onšov|Znojmo|10|77
00667773|Pohorovice|Strakonice|2|77
00667838|Skály|Strakonice|2|77
47922541|Srbce|Prostějov|11|77
15054241|Biskupice|Chrudim|8|76
00179680|Boňkov|Havlíčkův Brod|9|76
00476846|Bratronice|Strakonice|2|76
00572985|Brodeslavy|Plzeň - sever|3|76
00573931|Lhotka u Radnic|Rokycany|3|76
42634601|Olší|Jihlava|9|76
00373869|Ořechov|Jihlava|9|76
43313841|Ostřetice|Klatovy|3|76
00378364|Přeckov|Třebíč|9|76
00582930|Probulov|Písek|2|76
00268178|Rybníček|Havlíčkův Brod|9|76
00640085|Vodranty|Kutná Hora|1|76
00579122|Chlístov|Rychnov nad Kněžnou|7|75
00512664|Jedlany|Tábor|2|75
00473367|Litichovice|Benešov|1|75
00637777|Zhoř|Brno - venkov|10|75
00476722|Doňov|Jindřichův Hradec|2|74
00512613|Haškovcova Lhota|Tábor|2|74
00256951|Mohelnice|Plzeň - jih|3|74
00365297|Nelepeč-Žernůvka|Brno - venkov|10|74
00179761|Pohleď|Havlíčkův Brod|9|74
00584061|Těchobuz|Pelhřimov|9|74
00373770|Klatovec|Jihlava|9|73
00509400|Kluky|Mladá Boleslav|1|73
00511285|Proseč|Pelhřimov|9|73
00667617|Krejnice|Strakonice|2|72
00853992|Plchovice|Ústí nad Orlicí|8|72
00473464|Šetějovice|Benešov|1|72
00599816|Skryje|Brno - venkov|10|72
00876097|Nový Dvůr|Nymburk|1|71
00875775|Ostrov|Benešov|1|71
00573108|Pastuchovice|Plzeň - sever|3|71
48146994|Pšánky|Hradec Králové|7|71
00666891|Vícemil|Jindřichův Hradec|2|71
00636070|Vikantice|Šumperk|11|71
47730871|Bukovník|Klatovy|3|70
00259543|Přebuz|Sokolov|4|70
00667200|Třebějice|Tábor|2|70
00639770|Bdín|Rakovník|1|69
00475840|Ježov|Pelhřimov|9|69
00582808|Katov|Tábor|2|69
00639893|Krakovec|Rakovník|1|69
43313833|Mezihoří|Klatovy|3|69
00512745|Újezdec|Jindřichův Hradec|2|69
00511340|Útěchovičky|Pelhřimov|9|69
00667285|Záhoří|Tábor|2|69
18246028|Dolní Hradiště|Plzeň - sever|3|68
00573426|Horská Kvilda|Klatovy|3|68
00636339|Lhotka|Přerov|11|68
00654094|Libchyně|Náchod|7|68
00667706|Milejovice|Strakonice|2|68
00636908|Oslnovice|Znojmo|10|68
42634687|Volevčice|Jihlava|9|68
00579840|Horní Paseka|Havlíčkův Brod|9|67
00377252|Hornice|Třebíč|9|67
00477141|Hornosín|Strakonice|2|67
00583863|Okrouhlá|Písek|2|67
00378453|Popůvky|Třebíč|9|67
00667897|Třešovice|Strakonice|2|67
00637084|Vevčice|Znojmo|10|67
49457284|Zálesná Zhoř|Brno - venkov|10|67
42409764|Dívčí Kopy|Jindřichův Hradec|2|66
00473499|Dunice|Benešov|1|66
00852759|Nová Pláň|Bruntál|13|66
00579599|Nová Ves u Jarošova|Svitavy|8|66
00583146|Zábrdí|Prachatice|2|66
00511366|Eš|Pelhřimov|9|65
00572217|Hora Svatého Václava|Domažlice|3|65
00600610|Kunčina Ves|Blansko|10|65
00580091|Slavníč|Havlíčkův Brod|9|65
00667919|Únice|Strakonice|2|65
00580490|Urbanice|Pardubice|8|65
18246095|Velečín|Plzeň - sever|3|65
00581534|Závraty|České Budějovice|2|65
00573035|Blažim|Plzeň - sever|3|64
47256851|Březí|Strakonice|2|64
00473405|Choratice|Benešov|1|64
00578304|Dílce|Jičín|7|64
00572951|Slatina|Plzeň - sever|3|64
00583553|Střítež pod Křemešníkem|Pelhřimov|9|64
00511331|Útěchovice|Pelhřimov|9|64
18244033|Vísky|Rokycany|3|64
00579661|Vrážné|Svitavy|8|64
00636215|Dolní Těšice|Přerov|11|63
00511242|Lesná|Pelhřimov|9|63
48527432|Lovčovice|Třebíč|9|63
00279412|Pustina|Ústí nad Orlicí|8|63
00666904|Rosička|Jindřichův Hradec|2|63
00640018|Václavy|Rakovník|1|63
00473502|Děkanovice|Benešov|1|62
00194549|Janůvky|Svitavy|8|62
00667102|Radimovice u Tábora|Tábor|2|62
00583421|Vrbice|Prachatice|2|62
00512541|Čenkov u Bechyně|České Budějovice|2|61
00599638|Nový Jimramov|Žďár nad Sázavou|9|61
42634563|Zadní Vydří|Jihlava|9|61
00374229|Zdeňkov|Jihlava|9|61
00579939|Lány|Havlíčkův Brod|9|60
00583103|Olšovice|Prachatice|2|60
00509078|Rabakov|Mladá Boleslav|1|60
00599794|Řikonín|Brno - venkov|10|60
00580651|Holotín|Pardubice|8|59
00572942|Holovousy|Plzeň - sever|3|59
00511501|Syrov|Pelhřimov|9|59
00574082|Bolkov|Plzeň - jih|3|58
49540858|Košice|Kutná Hora|1|58
49463985|Louka|Blansko|10|58
00636835|Lubnice|Znojmo|10|58
00662917|Nestrašovice|Příbram|1|58
00582514|Pohnánec|Tábor|2|58
00579173|Proruby|Rychnov nad Kněžnou|7|58
00579629|Řídký|Svitavy|8|58
00373915|Sedlatice|Jihlava|9|58
00578207|Stanovice|Trutnov|7|58
00574074|Životice|Plzeň - jih|3|58
00512249|Bělá|Pelhřimov|9|57
00378232|Nimpšov|Třebíč|9|57
00572993|Všehrdy|Plzeň - sever|3|57
00473421|Xaverov|Benešov|1|57
00666912|Drunče|Jindřichův Hradec|2|56
00579831|Heřmanice|Havlíčkův Brod|9|56
47015951|Velká Chmelištná|Rakovník|1|56
00667960|Zvotoky|Strakonice|2|56
46687700|Lažany|Strakonice|2|55
00578312|Dolní Lochov|Jičín|7|54
00579505|Hartinkov|Svitavy|8|54
00376973|Horní Smrčné|Třebíč|9|54
00600415|Jiřice u Moravských Budějovic|Znojmo|10|54
00573434|Mlýnské Struhadlo|Klatovy|3|54
00581887|Strýčice|České Budějovice|2|54
00574252|Týniště|Plzeň - jih|3|54
46684441|Budyně|Strakonice|2|53
43313922|Domoraz|Klatovy|3|53
00666394|Hadravova Rosička|Jindřichův Hradec|2|53
00636088|Janoušov|Šumperk|11|53
00580121|Úhořilka|Havlíčkův Brod|9|53
00582948|Kožlí|Písek|2|52
00599549|Kyjov|Žďár nad Sázavou|9|52
00599565|Lubné|Brno - venkov|10|52
00583502|Martinice u Onšova|Pelhřimov|9|52
00667935|Vacovice|Strakonice|2|52
47248998|Důl|Pelhřimov|9|51
48378046|Kařízek|Rokycany|3|51
00637238|Makov|Blansko|10|51
00667692|Měkynec|Strakonice|2|51
00578509|Petrovičky|Jičín|7|51
00583537|Rovná|Pelhřimov|9|51
18243657|Štítov|Rokycany|3|51
00667196|Svrabov|Tábor|2|51
00666572|Vlčetínec|Jindřichův Hradec|2|51
00667951|Zahorčice|Strakonice|2|51
00599573|Milasín|Žďár nad Sázavou|9|50
00599603|Moravecké Pavlovice|Žďár nad Sázavou|9|50
00580139|Vlkanov|Havlíčkův Brod|9|50
00508403|Chleby|Benešov|1|49
00573981|Chlum|Rokycany|3|49
00573990|Hradiště|Rokycany|3|49
00599557|Líšná|Žďár nad Sázavou|9|49
49180592|Polánka|Plzeň - jih|3|49
00473391|Slověnice|Benešov|1|49
00581933|Vlkov|České Budějovice|2|49
00666599|Županovice|Jindřichův Hradec|2|49
00599701|Račice|Žďár nad Sázavou|9|48
00373931|Svojkovice|Jihlava|9|48
00572454|Všepadly|Domažlice|3|48
46684492|Kuřimany|Strakonice|2|47
43313892|Maňovice|Klatovy|3|47
46684476|Hájek|Strakonice|2|46
00667803|Radějovice|Strakonice|2|46
00374458|Rosička|Žďár nad Sázavou|9|46
00580104|Sloupno|Havlíčkův Brod|9|46
00512532|Bradáčov|Tábor|2|45
00583456|Chýstovice|Pelhřimov|9|45
00512788|Dobrohošť|Jindřichův Hradec|2|45
00636738|Lhota u Olešnice|Blansko|10|45
00583073|Lužice|Prachatice|2|45
48770485|Mutkov|Olomouc|11|45
00636924|Podhradí nad Dyjí|Znojmo|10|45
00511498|Zlátenka|Pelhřimov|9|45
00582972|Bohunice|Prachatice|2|44
00583464|Jankov|Pelhřimov|9|44
00583049|Kratušín|Prachatice|2|44
00362166|Hostějov|Uherské Hradiště|12|41
00579670|Želivsko|Svitavy|8|41
00498645|Těchařovice|Příbram|1|40
00373958|Vápovice|Jihlava|9|40
00599425|Chlum-Korouhvice|Žďár nad Sázavou|9|39
00477427|Chobot|Strakonice|2|39
00277606|Vysoká|Svitavy|8|39
00572241|Hvožďany|Domažlice|3|38
00578398|Kostelec|Jičín|7|38
00853097|Šléglov|Šumperk|11|38
49744780|Studená|Plzeň - sever|3|37
49464051|Ústup|Blansko|10|37
42634571|Vanůvek|Jihlava|9|37
00637157|Zblovice|Znojmo|10|37
00667277|Zadní Střítež|Tábor|2|36
00508535|Hradiště|Benešov|1|35
44224869|Staňkovice|Litoměřice|5|35
00599832|Spělkov|Žďár nad Sázavou|9|33
00572497|Kaničky|Domažlice|3|31
00498602|Čejkovice|Kutná Hora|1|28
00511749|Minice|Písek|2|28
00640280|Bludov|Kutná Hora|1|25
00574007|Čilá|Rokycany|3|19
00511374|Vysoká Lhota|Pelhřimov|9|16`;
