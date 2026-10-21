# MGPS ERP ko apne hamesha-on PC/server par chalana — zero se guide

Yeh guide unke liye hai jinhone pehle server deploy nahi kiya. Har command ko
`code` box se copy karke Ubuntu ke Terminal mein chalana hai. Kisi command ka
error aaye to aage mat badhna; error ka screenshot le kar kisi bharosemand
technician ko dikhao. Screenshot share karne se pehle passwords, tokens, email
addresses aur database URLs chhupa dena.

## Is guide mein hum kya karenge

- Ek **alag, hamesha-on PC** par Ubuntu Server install karenge.
- Usi PC par MGPS ERP ka Node.js backend aur PostgreSQL database chalayenge.
- Website ko filhaal Vercel par hi rehne denge; use sirf naye backend ka address
  denge. Isse website ka frontend naye PC par shift nahi hoga.
- Cloudflare Tunnel se secure HTTPS address banayenge. Router mein ports kholne
  ki zaroorat nahi honi chahiye.
- Pehle database ka backup aur test karenge; sab verify hone ke baad hi users
  ko naye server par bhejenge.

**Bijli wapas aane par automatic start:** Backend aur PostgreSQL ko Ubuntu
services ke roop mein boot par start karne ke liye set kiya ja sakta hai. Lekin
bijli jaane par agar PC poori tarah band ho gaya, to use phir on karna BIOS/UEFI
ki setting par depend karega. PC ke BIOS/UEFI mein `Restore AC Power Loss`,
`AC Back`, `After Power Failure` ya milte-julte option ko **Power On** set
karna hota hai. Har PC mein option/menu alag hota hai; exact motherboard/PC
manual follow karo ya technician se karwao. Yeh setting PC ko electricity
wapas aane par boot karne ko kehti hai—bijli ke baghair chalati nahi. UPS short
power cut mein kaam jaari rakhne mein madad karta hai.

**Zaroori:** Is setup ke baad ERP tabhi online rahega jab server PC, bijli aur
internet chalte rahenge. UPS (bijli jaane par temporary backup), reliable
internet aur off-site database backup zaroor rakho. SSD badhane se backup ka
substitute nahi milta.

## Laptop par server? Agar laptop band ho gaya to?

Laptop par backend aur database chal sakte hain, lekin ek baat yaad rakho:
**agar laptop shut down, sleep, battery-dead, internet se disconnected ya
unplugged ho gaya, to us laptop par host hua ERP ka backend aur local database
users ke liye unavailable ho jayega.** Laptop ko sirf server banane se woh
band hone ke baad bhi online nahi rehta.

Tumhare paas ye options hain:

1. **ERP ko Render par hi rehne do:** Laptop band ho tab bhi hosted Render
   backend online reh sakta hai, jab tak Render service/database aur internet
   connection active hain. Yeh abhi sabse aasaan option hai; laptop ko server
   banane ki zaroorat nahi. Current free/paid plan ki uptime, sleep aur charges
   Render dashboard mein check karo.
2. **Alag ghar/school PC ko server banao:** PC ko 24/7 on, Ethernet aur UPS par
   rakho. PC, bijli, router ya internet band hua to local server rukega. Pehle
   guide ke steps follow karo.
3. **Cloud VPS par backend rakho:** Provider ke hamesha-on internet-connected
   server par backend deploy hoga, isliye tumhara laptop band hone par bhi
   backend chal sakta hai. VPS par monthly fee, server security/updates aur
   backups tumhe ya technician ko manage karne honge. Agar database bhi usi VPS
   par rakha, database us VPS ke online rehne par depend karega; managed
   PostgreSQL alag service hoti hai aur uski alag fee ho sakti hai.

Laptop ko lid band karte hi sleep na hone dena, charger lagaye rakhna, sleep
disable karna aur UPS lagana accidental interruption kam kar sakte hain; lekin
ye laptop ko "band hone par bhi online" nahi banate. Router aur ISP internet bhi
chalu hone chahiye. Agar tumhara matlab ye hai ki **laptop use na karte waqt**
screen band/lid close ho, par machine andar se chalti rahe, to OS ki power
settings badal kar ho sakta hai—magar laptop phir bhi on aur internet-connected
rehna zaroori hai.

## Tumhe kya-kya chahiye

### Server PC ki specifications — kya khareedna hai

Is ERP ke liye **dedicated desktop/workstation** lo; gaming graphics card ki
zaroorat nahi. Agar school ke users ek hi samay par kaafi zyada hon ya bahut
saari files upload hoti hon, to pehle test/load aur current database/file size
dekh kar specs badhao. Yeh practical starting point hai, guaranteed capacity
ka wada nahi.

| Part | Minimum (halka use/test) | Behtar upgrade target |
|---|---|---|
| CPU | 4-core 64-bit Intel Core i5 / Ryzen 5 class | Intel Core i5 8th Gen ya newer; example i5-8500 (6 cores) |
| Memory (RAM) | 8 GB se boot/test ho sakta hai; production ke liye kam | 16 GB; baad mein 32 GB |
| Main disk | 256 GB SSD; production data ismein fit hona chahiye | 512 GB–1 TB SSD; zaroorat par 2 TB |
| Network | 1 Gbps Ethernet port | 1 Gbps Ethernet, router tak wired cable; Wi-Fi ko primary connection mat rakho |
| Graphics | CPU mein built-in graphics kaafi hai | Alag graphics card ki zaroorat nahi |
| Backup disk | — | Alag 2–4 TB external drive, size actual data aur backup policy ke mutabiq |
| Power | Server aur router ke load ke hisaab ka UPS | Line-interactive UPS; PC + router ka total watt load support kare aur safe shutdown ke liye waqt de |

### ₹17,000 budget mein kya lo (monitor tumhare paas hai)

₹17,000 mein **naya, reliable desktop + UPS + alag backup drive** sab lena
mushkil hai. Monitor tumhare paas hai, isliye budget ko **refurbished/used
business desktop tower** par lagao. Ubuntu chalane ke liye Windows license ya
gaming graphics card mat khareedo.

**Target configuration (used/refurbished):**

- Dell OptiPlex `3060/5060 MT`, HP ProDesk/EliteDesk `G4 MT`, ya Lenovo
  ThinkCentre `M720t` jaisa **Micro Tower / Tower** form factor.
- Intel Core i5-8500 (8th Gen, 6 cores) ya isi generation ka 6-core i5.
- Shuru se 16 GB RAM aur kam-se-kam 256 GB SSD.
- Gigabit Ethernet. Wi-Fi adapter optional hai, par server ko cable se jodo.
- Price/location/condition se model milna vary karega. ₹17,000 ke andar
  condition aur warranty ke saath aisa set na mile to jaldi mein mat khareedo:
  thoda aur budget jodo, ya filhaal existing hosted server use karo.

**Expand karne ke liye khareedne se pehle seller se confirm/check karo:**

1. Cabinet **MT/Tower** hai, Micro/SFF/Mini nahi. Tower mein aam taur par
   standard upgrades ke liye zyada jagah hoti hai; phir bhi har model ka manual
   alag hota hai.
2. Motherboard par kitne RAM slots hain, abhi kitne khaali hain aur supported
   maximum RAM kitni hai. Do RAM sticks se 16 GB (2×8 GB) theek hai; 32 GB tak
   upgrade karne ka supported path likhwa/verify karwao.
3. Extra 2.5-inch/3.5-inch SATA drive bay, SATA data/power cable aur PSU
   connectors hain ya nahi. NVMe M.2 slot ka hona bhi exact model manual mein
   check karo—har refurbished unit mein ek jaisa nahi hota.
4. BIOS/UEFI mein bijli wapas aane par auto power-on ka option (`Restore AC
   Power Loss`) available hai.
5. SSD health, RAM test, fan/noise/temperature, Ethernet port aur saare USB
   ports check karwao. Invoice, return policy aur kam-se-kam 3–6 mahine ki
   written warranty maango, agar seller deta ho.

**Pehla upgrade:** budget allow kare to pehle RAM ko 16 GB rakho/upgrade karo;
phir database/files ke size ke mutabiq SSD ko 1 TB ya bada karo. Data ko
transfer karne se pehle current backup size check karo: 256 GB SSD tabhi chalegi
jab Ubuntu, database, files aur free-space margin sab usmein fit hon. File
storage zyada ho to extra internal SSD baad mein add karo.

Is budget mein dedicated UPS aur external backup drive ke liye alag paisa
shayad na bache. Server ko school ke live data ke liye use karne se pehle
**UPS + off-site backup** ka intezam karna zaroori hai. Sirf internal SSD par
backup mat rakho. Agar ₹17,000 sab kuch mila kar tumhara final budget hai, to
local server cutover abhi mat karo—Render/hosted setup par raho jab tak PC,
UPS aur backups alag se afford na ho jaayen.

**SSD sizing:** `1 TB` app aur database ke liye starting recommendation hai,
lekin ERP files PostgreSQL mein store ho sakti hain—documents/photos ka data
tez badh sakta hai. Pehle Render/PostgreSQL ka database backup size aur file
storage count/size dekh kar extra jagah rakho. Database ko SSD par aur backup
ko alag drive/off-site location par rakho. Ek hi SSD ke doosre partition par
backup rakhna real backup nahi; alag SSD bhi off-site copy ka substitute nahi.

**Internet:** stable broadband aur router ko 24/7 on rakho; server ko router se
Ethernet cable se jodo. Upload speed khaas taur par photos/files aur ek waqt
mein kai users ke liye maayne rakhti hai. Apne ISP se upload speed, data cap,
service reliability aur outage support confirm karo. Cloudflare Tunnel aam
tor par public static IP/port forwarding ke bina kaam karta hai, lekin ISP ki
internet service phir bhi chahiye.

**UPS:** UPS ko PC ke saath router/modem ko bhi power dene layak lo. UPS par
`VA` ke saath actual `W` rating dekho; connected devices ke total watt load se
upar margin rakho. Zaroori nahi ki UPS lamba backup de—maqsad chhote power cut
cover karna aur orderly shutdown ka waqt dena hai. Bijli band ho kar wapas aaye
to PC khud boot hone ke liye BIOS/UEFI mein `Restore AC Power Loss` / `After
Power Failure` ko `Power On` set karna hoga. Is setting ko technician se test
karwao.

5. Server par Ubuntu Server install karne ke liye 8 GB ya usse bada USB drive.
6. School domain/DNS account ka admin access. Is guide ke example mein API
   address `api.mghub.marigoldschoolbehror.com` hai. Domain account tumhare
   control mein na ho to domain owner/IT person ki madad lo.
7. GitHub repository ka access, PostgreSQL server ka backup banane ki access,
   aur production environment variables/secrets ka access.
8. Ubuntu install karne, domain DNS badalne aur ERP data migrate karne ke waqt
   ek bharosemand IT technician ko paas rakhna behtar hai. Is system mein
   students/staff ki private information ho sakti hai.

### Kis cheez ko nahi karna

- Yeh steps **naye/dedicated server PC** par karo. Kisi personal PC par OS
  reinstall mat karo jab tak uski files ka alag verified backup na ho.
- Ubuntu installer mein disk erase karne se us disk ka purana data mit jayega.
  Galat disk select hui to personal files hamesha ke liye kho sakti hain.
- GitHub ya chat mein `.env`, password, API key, database URL ya Cloudflare
  token mat bhejo. Ye credentials kisi aur ko dikh gaye hon to unhe rotate karo.
- PostgreSQL port `5432` ko internet par expose mat karo. Sirf PC ke andar
  (localhost) se database connection chahiye.
- Render/Vercel/database ko migration verify hone se pehle cancel ya delete mat
  karo.

## Step 1 — Server PC par Ubuntu install karo

1. Naye PC par Ubuntu Server LTS install karo. Ubuntu ISO sirf official Ubuntu
   website se download karo; doosre PC par Ubuntu installer USB banane ke liye
   balenaEtcher ya Rufus ka istemal ho sakta hai.
2. Installer mein sahi SSD ko target karo. **“Erase disk” selected disk ka sab
   data delete karta hai.** Agar PC mein multiple disks hon ya samajh na aaye,
   yahin ruko aur technician se disk identify karwao.
3. Ubuntu install karte waqt ek naam aur password banao. Password ko safe,
   private jagah likho; is guide mein use paste karne ko nahi kaha gaya.
4. Installer pooche to “Install OpenSSH server” select karna theek hai; lekin
   SSH ko public internet par khula mat chhodo. Nahi pata ho to skip karo—PC par
   monitor/keyboard se seedha login kar sakte ho.
5. Install ke baad login karo, Ethernet cable lagao, aur internet test karo.

Terminal kholne ke liye login ke baad `Ctrl + Alt + T` dabao. Pehle system
update karo:

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

Restart ke baad phir login karo. Server ko ek jagah rakho jahan hawa nikal sake,
lekin paani, dhool aur public access se bacha rahe. PC ko automatic sleep mein
jaane mat do.

## Step 2 — Node.js, PostgreSQL aur Git install karo

Node.js 22 is project ki requirement hai. Terminal mein neeche ke commands
**ek-ek karke** chalao:

```bash
sudo apt install -y ca-certificates curl git postgresql postgresql-contrib
```

Node.js 22 install karo:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Version check karo:

```bash
node --version
npm --version
git --version
psql --version
```

`node --version` ka output `v22...` hona chahiye. Agar nahi, aage mat badho.

## Step 3 — Project server par lao

Pehle GitHub par check karo ki server chalane ke liye zaroori code waqai
repository mein saved/pushed hai. Sirf apne laptop ki unsaved local files ko
server par GitHub clone se nahi paaya ja sakta. Private repository ke liye GitHub
access set up karna padega; apna password/token kisi command ya chat mein mat
likho.

Server PC par project clone karo:

```bash
sudo mkdir -p /opt/mgps-erp
sudo chown "$USER":"$USER" /opt/mgps-erp
git clone https://github.com/parvchaturvedi-dev/Marigold-Secondary-School-ERP-System.git /opt/mgps-erp
cd /opt/mgps-erp
```

Agar GitHub kahe ki repository private hai ya access nahi hai, ruk jao. GitHub
account/SSH access technician se configure karwao. Public repository na ho to
upar wala clone command kaam nahi karega.

Dependencies install karo:

```bash
npm ci
```

Command bina error ke khatam hona chahiye. Is project mein backend ke liye
`npm start` aur PostgreSQL configured hai; MongoDB import scripts ko bina
soch-vichar production data par mat chalao.

## Step 4 — Naye PostgreSQL database mein live data copy karo

### Pehle samjho ki data kahan hai

Project ka current backend PostgreSQL use karta hai. Agar abhi live ERP Render
par chal raha hai to Render dashboard mein us backend se juda **PostgreSQL
database** pehchano. App ka “External Database URL”/external connection string
sirf database URL hai; Render web service URL nahi. Dashboard ke labels badal
sakte hain. Yaqeen na ho to technician ko Render dashboard dikhao.

**Agar production ERP MongoDB par hai, ya PostgreSQL database kaunsa hai
samajh nahi aata, to yahan ruk jao.** Neeche diye PostgreSQL backup commands ko
MongoDB par na chalao. Is repository mein Mongo-to-PostgreSQL scripts hain,
lekin woh alag migration process hai aur test/verification ke bina live data
par chalana theek nahi.

### 4A — Destination database banao

Naye server par PostgreSQL role (app login) banao. Pehla command password maangega.
Pehle is command se naya random password banao:

```bash
openssl rand -hex 24
```

Terminal mein dikhne wali value ko sirf apne password manager mein rakho; ise
chat/GitHub par mat bhejo. Phir createuser prompt mein wahi password do—Ubuntu
terminal mein type/paste karte waqt characters nazar nahi aayenge, yeh normal
hai. `.env` mein baad mein daalne ke liye isi value ko safe rakho.

```bash
sudo -u postgres createuser --pwprompt mgps_app
sudo -u postgres createdb --owner=mgps_app mgps_erp
```

Database abhi khaali hai. Agle step mein production ka snapshot yahan restore
hoga. Yeh pehli/test copy hai; cutover ke waqt alag final database banega.

### 4B — Pehle live database ka backup lo

Yeh **live production database ko modify nahi karta**; sirf ek copy banata hai.
Ubuntu Terminal mein yeh chalao:

```bash
read -rsp "Render PostgreSQL External Database URL (hidden input): " SOURCE_DATABASE_URL
echo
pg_dump --no-owner --no-acl --format=custom --dbname="$SOURCE_DATABASE_URL" --file="$HOME/mgps-erp-live.dump"
unset SOURCE_DATABASE_URL
chmod 600 "$HOME/mgps-erp-live.dump"
ls -lh "$HOME/mgps-erp-live.dump"
```

Prompt aane par Render dashboard se External Database URL copy karke terminal
mein paste karo aur Enter dabao. Paste karte waqt text nahi dikhega. URL ya uska
password kisi ko mat bhejna. `pg_dump` command ko error ke bina poora hona
chahiye aur backup file size zero nahi honi chahiye.

Agar Render database external connection allow nahi karta, `pg_dump` install
nahi hai, ya error aata hai to guess karke aage na badho—Render ki official
backup/export setting ya technician ki madad lo. Backup file ko secure rakho;
isme students/staff ki personal information aur PostgreSQL mein rakhe documents
ho sakte hain.

### 4C — Backup ko naye database mein restore karo

Pehle confirmation: source dump `mgps-erp-live.dump` bana, file ka size nazar aa
raha hai, aur destination `mgps_erp` naya/khaali database hai. Phir:

```bash
sudo -u postgres pg_restore --dbname=mgps_erp --no-owner --no-acl --role=mgps_app "$HOME/mgps-erp-live.dump"
```

Yeh restore **naye local database** mein hota hai. Agar `already exists`,
permission, extension ya version error aaye to database ko delete/recreate
karne ya random `DROP` command chalane ki koshish na karo; technician se
diagnose karwao.

Basic table check:

```bash
sudo -u postgres psql -d mgps_erp -c "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
sudo -u postgres psql -d mgps_erp -c "SELECT to_regclass('public.users') AS users_table, to_regclass('public.user_sessions') AS sessions_table, to_regclass('public.cloudinary_assets') AS files_table;"
```

Project ko start karne ke liye is guide mein purane Render database par likhna
band nahi hota. Yeh pehli/test copy hai. Cutover ke waqt alag, fresh local
database mein final copy bhi karni hogi—Step 10 dekho. Dono local databases ke
liye SSD par jagah check karo:

```bash
df -h
```

### Files/photos ka khaas dhyan

Project ki kuch files `cloudinary_assets` PostgreSQL table mein bytes ke roop
mein hain; poora PostgreSQL backup inhe bhi copy karta hai. Kuch purani files
Cloudinary par ho sakti hain. Jab tak har purana document/photo naye server par
open karke check nahi kiya, Cloudinary account aur uski `.env` credentials
active rakho. Cloudinary account delete na karo. Optional
`migrate:cloudinary-to-postgres` command ko bina technician ke mat chalao.

## Step 5 — Backend ki private settings (`.env`) banao

File path:

```text
/opt/mgps-erp/backend/.env
```

File editor kholne ke liye:

```bash
nano /opt/mgps-erp/backend/.env
```

Neeche template paste karo aur har placeholder ko apni real setting se badlo.
Yeh **example template hai, ise jaisa-ka-taisa mat chalao**:

```dotenv
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://mgps_app:APNA_HEX_DATABASE_PASSWORD@127.0.0.1:5432/mgps_erp

FRONTEND_URL=https://www.mghub.marigoldschoolbehror.com
CLIENT_ORIGIN=https://www.mghub.marigoldschoolbehror.com
CORS_ORIGINS=https://www.mghub.marigoldschoolbehror.com,https://mghub.marigoldschoolbehror.com

JWT_SECRET=PURANE_LIVE_SERVER_WALA_JWT_SECRET
SESSION_SECRET=PURANE_LIVE_SERVER_WALA_SESSION_SECRET

BREVO_API_KEY=PURANE_BREVO_API_KEY
BREVO_SENDER_EMAIL=SCHOOL_SENDER_EMAIL
BREVO_SENDER_NAME=MGPS ERP Portal
BREVO_OUTBOX_ENCRYPTION_KEY=PURANE_LIVE_SERVER_WALA_64_CHARACTER_HEX_KEY

CLOUDINARY_URL=PURANA_CLOUDINARY_URL
GEMINI_API_KEY=PURANA_GEMINI_API_KEY
GROQ_API_KEY=PURANA_GROQ_API_KEY
DEFAULT_AI_PROVIDER=gemini
HUGGINGFACE_API_TOKEN=PURANA_HUGGINGFACE_TOKEN
```

Rules:

- `APNA_HEX_DATABASE_PASSWORD` ko Step 4A mein `mgps_app` ke liye banaye
  password se badlo. Password mein URL ke special characters (`@`, `/`, `:`,
  `#`, `%`) hon to connection URL mein percent-encode karna padta hai. Isi liye
  simple letters+numbers ka random hex password chunna aasaan hai.
- `JWT_SECRET`, `SESSION_SECRET` aur `BREVO_OUTBOX_ENCRYPTION_KEY` ke liye
  **purane live backend ki asli values** lo; example words ko kabhi mat chhodo.
  Purane secrets nahi mil rahe to technician se madad lo. Secret badalne par
  existing logins expire ho sakte hain. Brevo encryption key badalne se pending
  encrypted email queue decrypt nahi ho sakti.
- `.env.example` mein aur optional settings bhi hain. Purane live server par
  configured mail/AI/Cloudinary features use hote hon to unki values ko secure
  tareeqe se copy karo; `.env.example` mein dikhaye placeholder values real
  credentials nahi hain. Original example [backend/.env.example](./backend/.env.example)
  hai.
- `CORS_ORIGINS` mein web app ka exact origin (protocol sahit, bina `/api`) hona
  chahiye. Current app ke Vercel/domain origins ko hatao mat. Agar frontend
  domain alag hai to usse comma ke saath add karo.
- `.env` ko save karne ke liye nano mein `Ctrl + O`, Enter, phir `Ctrl + X`
  dabao. File permissions private karo:

```bash
sudo chown "$USER":"$USER" /opt/mgps-erp/backend/.env
chmod 600 /opt/mgps-erp/backend/.env
```

`.env` ko GitHub par kabhi upload mat karo. Project `.gitignore` mein env files
ignore hoti hain, phir bhi Git status mein check karna zaroori hai.

## Step 6 — Pehli baar backend manually start karke test karo

```bash
cd /opt/mgps-erp
npm start
```

Terminal mein `PostgreSQL connected` aur `MGPS ERP API running on port 5000`
nazar aana chahiye. Server PC par **doosra** Terminal kholo (`Ctrl + Alt + T`)
aur health check karo:

```bash
curl -i http://127.0.0.1:5000/api/health
```

Sahi response mein HTTP `200` aur JSON ke andar `"ok":true` aur
`"database":"connected"` hona chahiye. Agar nahi, pehle Terminal mein error
dekho. Test khatam karne ke liye jis Terminal mein `npm start` chal raha hai
wahan `Ctrl + C` dabao.

Is stage par server sirf local PC par test hua hai; school ke users se connect
mat karwao.

## Step 7 — Restart ke baad backend ko automatic chalu rakho

Systemd service file banao:

```bash
sudo nano /etc/systemd/system/mgps-erp.service
```

Yeh paste karo:

```ini
[Unit]
Description=MGPS ERP backend
Wants=network-online.target
After=network-online.target postgresql.service

[Service]
Type=simple
User=REPLACE_WITH_UBUNTU_USERNAME
WorkingDirectory=/opt/mgps-erp
Environment=NODE_ENV=production
EnvironmentFile=/opt/mgps-erp/backend/.env
ExecStart=/usr/bin/node /opt/mgps-erp/backend/server/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

`REPLACE_WITH_UBUNTU_USERNAME` ko Step 1 mein banaye **Ubuntu login username**
se badlo—`$USER` mat likho. `ExecStart` ka Node path check karne ke liye
`which node` chalao; agar output `/usr/bin/node` nahi hai, technician se
service file sahi karwao. Nano mein `Ctrl + O`, Enter, `Ctrl + X` se save/exit.

Service on karo:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mgps-erp
sudo systemctl status mgps-erp --no-pager
```

Status `active (running)` hona chahiye. Logs dekhne ke liye:

```bash
sudo journalctl -u mgps-erp -n 80 --no-pager
```

`status` ya log mein error aaye to public address banane se pehle usse theek
karo.

## Step 8 — Secure public HTTPS address (Cloudflare Tunnel)

Tunnel browser/app ko HTTPS se backend tak pahunchata hai; database ko public
nahi karta aur router port-forwarding se bachata hai. Yeh hissa domain DNS ko
badal sakta hai, isliye domain owner/IT person se karwao.

1. Agar school domain abhi Cloudflare DNS par nahi hai, Cloudflare account mein
   domain add karo. Cloudflare ke diye gaye DNS records dekh kar **pehle
   current DNS ke A/CNAME, MX, TXT (SPF/DKIM/DMARC) aur anya records ki copy**
   rakho.
2. Domain registrar par nameservers badalne se website ya school email ruk
   sakta hai. Cloudflare mein records verify aur email/website test kiye bina
   nameservers switch mat karo. Doubt ho to domain administrator se madad lo.
3. Cloudflare dashboard ke Zero Trust/Networks/Tunnels area mein naya named
   Tunnel banao, naam `mgps-erp-server` rakho, aur **Ubuntu/Linux 64-bit**
   connector instructions kholo. Dashboard jo official install command aur
   long token de, wahi follow karo—token ko kisi ke saath share mat karo.
4. `cloudflared` ko Cloudflare ke dashboard mein diye Ubuntu instructions se
   install karo. Dashboard ka Linux service command `cloudflared service install`
   hota hai; token ke saath **sirf Cloudflare dashboard mein dikhaya command**
   chalao. Isse connector restart ke baad bhi chalu reh sakta hai.
5. Tunnel ke “Published application route”/“Public hostname” mein:
   - Hostname: `api.mghub.marigoldschoolbehror.com`
   - Service type: `HTTP`
   - Service URL: `localhost:5000`
6. Route save karke connector status `Healthy`/connected check karo.
   Cloudflare tunnel hostname HTTPS dega. Naya API address yeh hoga:
   `https://api.mghub.marigoldschoolbehror.com/api`
7. Server par test karo:

```bash
curl -i https://api.mghub.marigoldschoolbehror.com/api/health
```

HTTP `200`, `"ok":true`, `"database":"connected"` expected hai. Agar domain
abhi Cloudflare ke control mein nahi, tunnel public hostname complete nahi ho
sakta. Is case mein DNS/admin access lo; Render ko abhi mat band karo.

## Step 9 — Sirf preview par private test karo

### Web — Vercel dashboard se

**Production environment ko abhi mat badlo.** Pehle test ke liye Vercel Preview
environment use karo. Isse normal school users abhi bhi purane production
backend par rahenge.

1. Vercel dashboard → MGPS ERP frontend project → **Settings → Environment
   Variables** kholo.
2. `VITE_API_BASE_URL` naam aur value
   `https://api.mghub.marigoldschoolbehror.com/api` rakho. **Preview** environment
   select karo, Production nahi.
3. Save karo aur ek Preview deployment banao/redeploy karo. Uska preview URL
   kholo; test login aur records wahan try karo. Preview backend test DB ko use
   karega, live school data ko nahi. Preview URL ka origin pehle se backend
   CORS allowlist mein na ho to `CORS_ORIGINS` mein add karke service restart
   karo; CORS issue aaye to usse bypass mat karo.
4. Preview mein admin, teacher aur student ki aam screens, search, notices,
   files/photos, attendance, realtime, login/logout aur istemal hone wale mail/AI
   features test karo. Upload karke file dobara kholna bhi check karo. Test DB
   ka data baad mein final live database par copy nahi hoga.

Project ke web frontend mein production variable set na ho to woh default se
purane Render API ko use karta hai:
[frontend/src/services/api.js](./frontend/src/services/api.js).

### Mobile app — alag naya APK build lagega

Install ki hui mobile app apne andar purana Render URL rakhti ho sakti hai.
Mobile app ke source mein variable
`EXPO_PUBLIC_API_BASE_URL` hai; bina is variable ke app Render ko default karti
hai: [frontend-mobile/src/api/apiClient.js](./frontend-mobile/src/api/apiClient.js).

1. Production APK abhi build/distribute mat karo. Sirf preview test APK chahiye
   to Expo/EAS project ke **preview** environment mein
   `EXPO_PUBLIC_API_BASE_URL` ko
   `https://api.mghub.marigoldschoolbehror.com/api` set karo.
2. Test phone ke liye preview APK banao. Repository ke mobile README mein jo
   tested preview build profile diya hai wahi use karo; project root se mobile
   folder mein jaana hota hai:

```bash
cd /opt/mgps-erp/frontend-mobile
npx eas-cli build --platform android --profile preview
```

Build service ko preview environment variable ke saath chalana zaroori hai.
APK ko sirf ek test phone par install karke login, notifications/realtime,
photos/files aur app ke core screens test karo. Is test se users ko migrate mat
karo.

## Step 10 — Final data copy (actual cutover)

Step 4 ka backup **test copy** tha. Agar tabse live Render/production par koi
naya student, fee, attendance, notice, document ya doosra record save hua hai,
woh pehle backup mein nahi hoga.

1. School ke users ke saath downtime ka time tay karo. Unhe batao ki migration
   ke waqt ERP mein koi naya record nahi dalna.
2. Website/mobile ko temporary maintenance/“use mat karo” par rakho ya users
   ko sign out karke editing rok do. Jab tak writes rukne ki tasdeeq na ho,
   final backup mat banao. Aasaan beginner setup mein 30–60 minute ka planned
   downtime rakhna behtar hai.
3. Pehle Step 4B ka test backup alag naam se rakho, taaki final backup uske
   upar na likhe:

```bash
mv "$HOME/mgps-erp-live.dump" "$HOME/mgps-erp-test.dump"
```

Ab Step 4B ka `pg_dump` command dobara chala kar current production DB ka naya
final backup lo; file ka size check karo.
Final dump file ka size aur command success confirm hone ke baad Render par purani
**backend web service ko suspend** karo, PostgreSQL database ko nahi. Planned
downtime mein purani website/mobile temporarily kaam nahi karenge; isse final
backup ke baad purane Render DB mein extra writes nahi aayengi.

4. Pehli test copy ko chhede bina ek **naya, khaali final database** banao:

```bash
sudo -u postgres createdb --owner=mgps_app mgps_erp_final
sudo -u postgres pg_restore --dbname=mgps_erp_final --no-owner --no-acl --role=mgps_app "$HOME/mgps-erp-live.dump"
```

Yahan `mgps-erp-live.dump` woh final backup hona chahiye jo abhi, users ke writes
rokne ke baad banaya. Restore error aaye to cutover rok do.

5. Backend ki `.env` file kholo:

```bash
nano /opt/mgps-erp/backend/.env
```

`DATABASE_URL` ke aakhir mein `/mgps_erp` ko `/mgps_erp_final` se badlo. Baaki
purane secrets bilkul waise hi rakho. Save (`Ctrl + O`, Enter) karke exit
(`Ctrl + X`) karo; file permission dobara private karo:

```bash
chmod 600 /opt/mgps-erp/backend/.env
sudo systemctl restart mgps-erp
sudo systemctl status mgps-erp --no-pager
curl -i http://127.0.0.1:5000/api/health
```

Health check mein `"database":"connected"` aana chahiye. Ab Vercel dashboard →
frontend project → **Settings → Environment Variables** kholo. Production ke
`VITE_API_BASE_URL` ko
`https://api.mghub.marigoldschoolbehror.com/api` set karke save karo. Phir
**Deployments** se production deployment redeploy karo. Website par login aur
important records/files test accounts se check karo.

Mobile ke liye EAS **production** environment mein
`EXPO_PUBLIC_API_BASE_URL` ko
`https://api.mghub.marigoldschoolbehror.com/api` set karke production APK build
karo:

```bash
cd /opt/mgps-erp/frontend-mobile
npx eas-cli build --platform android --profile production
```

APK ko pehle ek test phone par install karke login, records, notifications aur
files verify karo; phir school users ko securely distribute karo. Purana
installed APK Render URL use karta hai aur ab suspended backend se connect nahi
hoga. Sab zaroori mobile users ko naya APK install/update karne mein madad karo.

6. Website aur mobile app dono ko naye server par test karne ke baad, aur
   users ko update instructions de kar, ERP dobara use karne do. Final database
   theek chalne aur backups verify hone tak pehli local test DB `mgps_erp` aur
   purane Render PostgreSQL resources ko delete mat karo.

**Rollback:** Agar final cutover par website/mobile kaam na kare aur naye server
par abhi koi naya data save nahi hua ho, purani Render backend service ko resume
karke Vercel ka API variable purane Render API par lauta kar redeploy kiya ja
sakta hai. Lekin naye local server par users ne records save karne ke baad
seedha Render par switch karoge to woh naye records Render mein nahi honge. Aisa
ho to ERP mein writes roko aur technician se data-reconciliation karwao—purane
DB par bina plan ke switch mat karo.

## Step 11 — Automatic database backup

Ek hi server ke andar backup rakhna SSD failure, chori, malware, aag ya bijli
se protection nahi hai. Neeche wala hissa **sirf local 14 din ki backup copies**
banata hai. Off-site encrypted copy alag se zaroor chahiye.

Backup script banao:

```bash
sudo mkdir -p /var/backups/mgps-erp
sudo chmod 700 /var/backups/mgps-erp
sudo nano /usr/local/sbin/backup-mgps-erp
```

Yeh script paste karo:

```bash
#!/usr/bin/env bash
set -euo pipefail

backup_dir="/var/backups/mgps-erp"
backup_file="$backup_dir/mgps-erp-$(date +%F-%H%M).dump"

install -d -m 700 "$backup_dir"
sudo -u postgres pg_dump --format=custom --no-owner --no-acl mgps_erp_final > "$backup_file"
chmod 600 "$backup_file"
find "$backup_dir" -maxdepth 1 -type f -name 'mgps-erp-*.dump' -mtime +14 -delete
```

Nano mein `Ctrl + O`, Enter, `Ctrl + X` dabao. Ise executable banao aur turant
test karo:

```bash
sudo chmod 700 /usr/local/sbin/backup-mgps-erp
sudo /usr/local/sbin/backup-mgps-erp
sudo ls -lh /var/backups/mgps-erp
```

Zero-byte dump ya error acceptable nahi. Daily 2:15 AM par chalane ke liye:

```bash
sudo crontab -e
```

Agar editor pooche to `nano` chuno. File ke bilkul end mein yeh ek line add
karo, save (`Ctrl + O`, Enter) aur exit (`Ctrl + X`) karo:

```cron
15 2 * * * /usr/local/sbin/backup-mgps-erp >> /var/log/mgps-erp-backup.log 2>&1
```

Har din backup log aur directory check karna hai:

```bash
sudo tail -n 50 /var/log/mgps-erp-backup.log
sudo ls -lh /var/backups/mgps-erp
df -h
```

Kam-se-kam ek copy encrypted external drive ya trusted off-site backup location
par niyamit taur par copy karo; school data ko unencrypted personal cloud par
upload mat karo. Kam-se-kam ek baar test database mein dump restore karke dekho,
warna backup ke kaam karne ka yaqeen nahi hota. Local disk, backup drive aur
restore test teenon ka access restricted rakho.

## Step 12 — Restart aur maintenance test

Backend startup test:

```bash
sudo systemctl restart mgps-erp
sudo systemctl status mgps-erp --no-pager
curl -i http://127.0.0.1:5000/api/health
```

Services ko boot par enable kiya hai, dobara verify karo:

```bash
sudo systemctl is-enabled postgresql
sudo systemctl is-enabled mgps-erp
sudo systemctl status cloudflared --no-pager
```

PostgreSQL aur `mgps-erp` ke liye `enabled` aana chahiye. Cloudflare connector
ke liye service name install ke tareeqe ke hisaab se farq ho sakta hai. Agar
`cloudflared` service milti hai lekin enabled nahi hai to:

```bash
sudo systemctl enable --now cloudflared
```

Agar service not found aaye to apne Cloudflare dashboard ke Tunnel connector
instructions follow karo; koi doosra naam andaze se enable mat karo.

Server reboot test:

```bash
sudo reboot
```

PC wapas chalu hone ke baad login karke check karo:

```bash
sudo systemctl status postgresql --no-pager
sudo systemctl status mgps-erp --no-pager
sudo systemctl status cloudflared --no-pager
curl -i https://api.mghub.marigoldschoolbehror.com/api/health
```

Server ko bilkul bijli se disconnect karke test karne ke bajaye pehle safe
planned maintenance mein technician se BIOS/UEFI ki AC-loss setting aur UPS
check karwao. PC boot ho to network, PostgreSQL, `mgps-erp` aur Cloudflare
connector sab running hone chahiye. Public health check mein
`"database":"connected"` aana chahiye.

Tunnel bhi Cloudflare dashboard mein connected/Healthy dikhna chahiye. Website
aur test mobile par phir login/files check karo.

## Common problems — pehle kya check karna hai

| Problem | Pehli check |
|---|---|
| `DATABASE_URL is not configured` | `/opt/mgps-erp/backend/.env` file maujood, readable aur service `EnvironmentFile` sahi hai? |
| `password authentication failed` | `mgps_app` password aur `.env` URL match karte hain? Special characters URL-encoded hain? |
| `Required PostgreSQL tables are missing` | Sahi production DB ka **poora final backup** restore hua? `cloudinary_assets` aur ERP tables maujood hain? |
| Backend `active (running)` nahi | `sudo journalctl -u mgps-erp -n 80 --no-pager` mein pehla error padho; `.env` secrets chat mein mat bhejo. |
| Health endpoint local sahi, public fail | Cloudflare Tunnel connected hai? Public hostname/service `localhost:5000` hai? Domain/DNS complete hai? |
| Browser mein CORS error | `.env` ke `CORS_ORIGINS` mein website ka exact `https://...` origin hai? Environment change ke baad service restart ki? |
| Login works nahi / 401 | Vercel aur mobile sahi API use karte hain? Final DB mein users hain? JWT/session secrets purane live values hain? |
| Photos/files missing | `cloudinary_assets` table backup mein tha? Legacy Cloudinary assets ke liye account/credentials active hain? |
| PC reboot ke baad offline | PostgreSQL, `mgps-erp` systemd service aur Cloudflare connector sab enabled/running hain? |
| Website online, ghar/school se bahar offline | Home ISP internet/upload, router aur bijli live hain? Cloudflare Tunnel ka status Healthy hai? |

Useful commands:

```bash
sudo systemctl status mgps-erp --no-pager
sudo journalctl -u mgps-erp -n 80 --no-pager
sudo systemctl status postgresql --no-pager
df -h
curl -i http://127.0.0.1:5000/api/health
```

## Security aur ongoing zimmedari

- Ubuntu security updates lagao, lekin update/reboot se pehle check karo ki
  backup safal hai aur maintenance window hai.
- Router mein PostgreSQL port `5432` ya app port `5000` forward mat karo.
  Cloudflare Tunnel ko sirf API port `5000` tak route karo.
- Admin credentials, `.env`, SSH keys, database backups aur Cloudflare token ko
  private rakho; school data ke liye access sirf authorized staff ko do.
- UPS, internet outage alerts, SSD space, database backup aur actual restore
  test ko regular check karo. PC server hone se automatic professional support
  ya guaranteed 24/7 availability nahi milti.
- Existing Render/Vercel plans ko tabhi downgrade/cancel karo jab kuch hafton
  tak naya server stable ho, off-site backups verify hon, aur school management
  cutover accept kare.

## Tumhare project mein important paths

- Backend environment example: [backend/.env.example](./backend/.env.example)
- Backend startup: [backend/server/index.js](./backend/server/index.js)
- PostgreSQL connection/schema checks: [backend/server/db.js](./backend/server/db.js)
- Web API address config: [frontend/src/services/api.js](./frontend/src/services/api.js)
- Mobile API address config: [frontend-mobile/src/api/apiClient.js](./frontend-mobile/src/api/apiClient.js)
- Database migration notes: [README.md](./README.md)
