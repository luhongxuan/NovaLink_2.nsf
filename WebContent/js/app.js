/* =====================================================================
   NovaLink 前端邏輯 (Vue 3 + axios + Domino REST API / DAS)
   --------------------------------------------------------------------
   如果你的資料庫路徑不同，只要改下面這一行 DB_PATH 即可。
   ===================================================================== */
const DB_PATH   = '/student/B11209013/NovaLink_1.nsf';
const API_ROOT  = DB_PATH + '/api/data';
const COLL      = API_ROOT + '/collections/name';   // 讀 View
const DOCS      = API_ROOT + '/documents';          // 建立 / 讀取文件

const { createApp } = Vue;

createApp({
  data() {
    return {
      // 時鐘
      now: new Date(),
      // 導覽
      currentPage: 'home',
      tabs: [
        { id:'home',     icon:'🏠', label:'總覽' },
        { id:'mood',     icon:'😊', label:'情緒溫度計' },
        { id:'thanks',   icon:'💌', label:'感謝卡牆' },
        { id:'proposal', icon:'💡', label:'創新提案' },
        { id:'coin',     icon:'🪙', label:'活力幣' },
      ],
      // 資料
      loading: false,
      errorMsg: '',
      moodList: [],
      thanksList: [],
      proposalList: [],
      coinList: [],
      currentUser: '',   // 第一次寫入後會自動取得
      // 彈窗
      modal: null,            // 'mood' | 'thanks' | 'proposal' | 'invest'
      submitting: false,
      modalError: '',
      investTarget: {},
      cardTypes: ['🤝 神隊友','🚒 救火英雄','💡 好點子','🌐 跨部門合作','💛 溫暖鼓勵'],
      categories: ['流程改善','產品創新','文化活動','IT 優化','其他'],
      moodForm:     { MoodScore:'', StressLevel:'3', Department:'', MoodNote:'', IsNotePublic:false },
      thanksForm:   { RecipientID:'', CardType:'', CardMessage:'', IsPublic:true },
      proposalForm: { ProposalTitle:'', Category:'', ProblemDesc:'', SolutionDesc:'', TargetCoins:100 },
      investForm:   { InvestAmount:'', InvestNote:'' },
      // toast
      toastMsg: '',
      _clockTimer: null,
    };
  },

  computed: {
    clockTime() {
      const d = this.now, p = n => String(n).padStart(2,'0');
      return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    },
    clockDate() {
      const d = this.now, wk = ['日','一','二','三','四','五','六'][d.getDay()];
      return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 星期${wk}`;
    },
    greetingName() { return this.currentUser ? this.cnName(this.currentUser) : '團隊夥伴'; },
    balance()    { return this.coinList.reduce((s,t)=> s + (Number(t.Amount)||0), 0); },
    totalEarn()  { return this.coinList.reduce((s,t)=>{ const a=Number(t.Amount)||0; return s+(a>0?a:0); },0); },
    totalSpend() { return this.coinList.reduce((s,t)=>{ const a=Number(t.Amount)||0; return s+(a<0?-a:0); },0); },
    todayMood()  {
      const c = this.todayCandidates();
      return this.moodList.find(m => c.includes(m.MoodDateStr)) || null;
    },
    modalTitle() {
      return { mood:'填寫今日情緒', thanks:'發送感謝卡', proposal:'提出新提案', invest:'投資創新提案' }[this.modal] || '';
    },
  },

  mounted() {
    this._clockTimer = setInterval(() => { this.now = new Date(); }, 1000);
    this.loadCurrentUser();
    this.refreshAll();
  },
  beforeUnmount() { clearInterval(this._clockTimer); },

  methods: {
    /* ---------- 導覽 ---------- */
    go(id) {
      this.currentPage = id;
      if (id === 'mood')     this.loadMood();
      if (id === 'thanks')   this.loadThanks();
      if (id === 'proposal') this.loadProposal();
      if (id === 'coin')     this.loadCoin();
    },
    async refreshAll() {
      this.loading = true; this.errorMsg = '';
      await Promise.all([ this.loadMood(), this.loadThanks(), this.loadProposal(), this.loadCoin() ]);
      this.loading = false;
    },

    /* ---------- 讀取 View ---------- */
    async loadMood() {
      try { const r = await axios.get(`${COLL}/VNLKM10?count=100`); this.moodList = this.docsOnly(r.data); }
      catch (e) { this.handleErr(e,'情緒'); }
    },
    async loadThanks() {
      try { const r = await axios.get(`${COLL}/VNLKM20?count=100`); this.thanksList = this.docsOnly(r.data); }
      catch (e) { this.handleErr(e,'感謝卡'); }
    },
    async loadProposal() {
      try { const r = await axios.get(`${COLL}/VNLKM30?count=100`); this.proposalList = this.docsOnly(r.data); }
      catch (e) { this.handleErr(e,'提案'); }
    },
    async loadCoin() {
      try { const r = await axios.get(`${COLL}/VNLKT51?count=100`); this.coinList = this.docsOnly(r.data); }
      catch (e) { this.handleErr(e,'活力幣'); }
    },
    async loadCurrentUser() {
      try {
        const resp = await axios.post(
          `${DOCS}?form=FNLKM01&computewithform=true`,
          { MoodScore: '3', StressLevel: '3' }
        );
        const loc = resp.headers.location || resp.headers.Location || '';
        const m = loc.match(/unid\/([0-9A-Fa-f]{32})/i);
        if (m) {
          const r = await axios.get(`${DOCS}/unid/${m[1]}`);
          this.currentUser = r.data.EmployeeID || '';
          await axios.delete(`${DOCS}/unid/${m[1]}`);
        }
      } catch(e) { console.warn('無法取得使用者資訊', e); }
    },
    docsOnly(arr) { return Array.isArray(arr) ? arr.filter(e => e && e['@unid']) : []; },
    handleErr(e, what) {
      console.error(`[NovaLink] 載入${what}失敗`, e);
      const code = e?.response?.status;
      if (code === 401) this.errorMsg = '尚未登入或權限不足，請先以你的帳號登入 Domino 後再開啟此頁。';
      else this.errorMsg = `載入${what}資料時發生問題（${code || '連線錯誤'}）。請確認 REST API 已啟用。`;
    },

    /* ---------- 彈窗開關 ---------- */
    openModal(name) {
      this.modal = name; this.modalError = '';
      if (name === 'mood')     this.moodForm     = { MoodScore:'', StressLevel:'3', Department:'', MoodNote:'', IsNotePublic:false };
      if (name === 'thanks')   this.thanksForm   = { RecipientID:'', CardType:'', CardMessage:'', IsPublic:true };
      if (name === 'proposal') this.proposalForm = { ProposalTitle:'', Category:'', ProblemDesc:'', SolutionDesc:'', TargetCoins:100 };
    },
    openInvest(p) {
      this.investTarget = p; this.investForm = { InvestAmount:'', InvestNote:'' };
      this.modal = 'invest'; this.modalError = '';
    },
    closeModal() { if (!this.submitting) { this.modal = null; this.modalError = ''; } },
    fallbackForm() {
      const map = { mood:'FNLKM01', thanks:'FNLKM02', proposal:'FNLKM03', invest:'FNLKR04' };
      window.open(`${DB_PATH}/${map[this.modal]}?OpenForm`, '_blank');
    },

    /* ---------- 送出 ---------- */
    submit() {
      if (this.modal === 'mood')     return this.submitMood();
      if (this.modal === 'thanks')   return this.submitThanks();
      if (this.modal === 'proposal') return this.submitProposal();
      if (this.modal === 'invest')   return this.submitInvest();
    },

    async submitMood() {
      if (!this.moodForm.MoodScore) { this.modalError = '請先選擇今天的心情。'; return; }
      if (this.todayMood) { this.modalError = '你今天已經填寫過情緒溫度計囉！'; return; }
      this.submitting = true; this.modalError = '';
      try {
        const body = {
          MoodScore:   this.moodForm.MoodScore,
          StressLevel: this.moodForm.StressLevel,
          Department:  this.moodForm.Department,
          MoodNote:    this.moodForm.MoodNote,
          IsNotePublic: this.moodForm.IsNotePublic ? '1' : '0',
        };
        const unid = await this.createDoc('FNLKM01', body);
        const me = await this.ownerOf(unid, 'EmployeeID');
        await this.issueCoin(me, 1, 'MoodEntry', unid, '每日填寫情緒溫度計');
        await this.afterCreate('mood', '情緒已記錄，+1 活力幣！');
      } catch (e) { this.failSubmit(e); }
      this.submitting = false;
    },

    async submitThanks() {
      const f = this.thanksForm;
      if (!f.RecipientID.trim()) { this.modalError = '請輸入收件者。'; return; }
      if (!f.CardType) { this.modalError = '請選擇卡片類型。'; return; }
      if (this.currentUser && f.RecipientID.trim().toLowerCase() === this.currentUser.toLowerCase()) {
        this.modalError = '不可以發感謝卡給自己喔！'; return;
      }
      this.submitting = true; this.modalError = '';
      try {
        const body = {
          RecipientID: f.RecipientID.trim(),
          CardType:    f.CardType,
          CardMessage: f.CardMessage,
          IsPublic:    f.IsPublic ? '1' : '0',
        };
        const unid = await this.createDoc('FNLKM02', body);
        const sender = await this.ownerOf(unid, 'SenderID');
        await this.issueCoin(sender,            2, 'ThanksCard_Send', unid, `發送感謝卡（${f.CardType}）`);
        await this.issueCoin(f.RecipientID.trim(),3, 'ThanksCard_Recv', unid, `收到感謝卡（${f.CardType}）`);
        await this.afterCreate('thanks', '感謝卡已送出，+2 活力幣！');
      } catch (e) { this.failSubmit(e); }
      this.submitting = false;
    },

    async submitProposal() {
      const f = this.proposalForm;
      if (!f.ProposalTitle.trim()) { this.modalError = '請輸入提案標題。'; return; }
      this.submitting = true; this.modalError = '';
      try {
        const body = {
          ProposalTitle: f.ProposalTitle.trim(),
          Category:      f.Category,
          ProblemDesc:   f.ProblemDesc,
          SolutionDesc:  f.SolutionDesc,
          TargetCoins:   Number(f.TargetCoins) || 100,
          Status:        'Open',     // 直接公開募資
        };
        const unid = await this.createDoc('FNLKM03', body);
        const me = await this.ownerOf(unid, 'ProposerID');
        await this.issueCoin(me, 5, 'Proposal_Submit', unid, `提出創新提案：${f.ProposalTitle.trim()}`);
        await this.afterCreate('proposal', '提案已公開，+5 活力幣！');
      } catch (e) { this.failSubmit(e); }
      this.submitting = false;
    },

    async submitInvest() {
      const amt = Number(this.investForm.InvestAmount);
      if (!amt || amt <= 0) { this.modalError = '請輸入有效的投資金額。'; return; }
      if (amt > this.balance) { this.modalError = `活力幣餘額不足（目前 ${this.balance}）。`; return; }
      this.submitting = true; this.modalError = '';
      try {
        const parentUnid = this.investTarget['@unid'];
        const body = { InvestAmount: amt, InvestNote: this.investForm.InvestNote };
        const unid = await this.createDoc('FNLKR04', body, `&parentid=${parentUnid}`);
        const me = await this.ownerOf(unid, 'InvestorID');
        await this.issueCoin(me, -amt, 'ProposalInvest', unid, `投資提案：${this.investTarget.ProposalTitle}`);
        await this.updateParentProposal(parentUnid, amt);
        await this.afterCreate('proposal', `已投資 ${amt} 活力幣，感謝你的支持！`);
      } catch (e) { this.failSubmit(e); }
      this.submitting = false;
    },

    // 投資後更新父提案的累積金額；達標則轉為待審並發給提案人 +50
    async updateParentProposal(parentUnid, amt) {
      try {
        const r = await axios.get(`${DOCS}/unid/${parentUnid}`);
        const p = r.data;
        const current = (Number(p.CurrentCoins)||0) + amt;
        const target  = Number(p.TargetCoins)||0;
        const patch = { CurrentCoins: current };
        if (target > 0 && current >= target && p.Status === 'Open') {
          patch.Status = 'Pending';
        }
        await axios.patch(`${DOCS}/unid/${parentUnid}?computewithform=true`, patch);
        if (patch.Status === 'Pending') {
          await this.issueCoin(p.ProposerID, 50, 'Proposal_Funded', parentUnid, `提案達標：${p.ProposalTitle}`);
          this.toast('🎉 提案已達標，進入審核！');
        }
      } catch (e) { console.warn('[NovaLink] 更新父提案失敗（不影響投資紀錄）', e); }
    },

    /* ---------- 共用 REST ---------- */
    // 建立文件，回傳 UNID
    async createDoc(form, fields, extra = '') {
      const url = `${DOCS}?form=${form}&computewithform=true${extra}`;
      const resp = await axios.post(url, fields);
      // 從 Location 取得 UNID
      const loc = (resp.headers && (resp.headers.location || resp.headers.Location)) || '';
      let m = loc.match(/unid\/([0-9A-Fa-f]{32})/);
      if (m) return m[1];
      // 後備：從回應內容取得
      const d = resp.data || {};
      if (d['@unid']) return d['@unid'];
      const href = d['@href'] || '';
      m = href.match(/unid\/([0-9A-Fa-f]{32})/);
      return m ? m[1] : null;
    },

    // 讀回某文件的擁有者欄位（= @UserName），並快取目前使用者
    async ownerOf(unid, field) {
      if (!unid) return this.currentUser || '';
      try {
        const r = await axios.get(`${DOCS}/unid/${unid}`);
        const val = r.data ? (r.data[field] || '') : '';
        if (val && !this.currentUser) this.currentUser = val;
        return val || this.currentUser || '';
      } catch (e) { return this.currentUser || ''; }
    },

    // 發活力幣（複製後端 NLK_IssueCoin 邏輯；採盡力而為，失敗不阻擋主流程）
    // 注意：不帶 computewithform，避免 Domino 對 datetime 格式驗證報 400
    async issueCoin(employeeID, amount, source, refDocID, desc) {
      try {
        if (!employeeID) return;
        let name = employeeID;
        const slash = name.indexOf('/');
        if (slash > 0) name = name.substring(0, slash);
        if (name.indexOf('CN=') === 0) name = name.substring(3);
        // 日期用 Domino 可接受的字串格式（MM/DD/YYYY HH:MM:SS）
        const nd = new Date();
        const p = n => String(n).padStart(2,'0');
        const refDateStr = `${nd.getFullYear()}/${p(nd.getMonth()+1)}/${p(nd.getDate())} ${p(nd.getHours())}:${p(nd.getMinutes())}:${p(nd.getSeconds())}`;
        const body = {
          EmployeeID:   employeeID,
          EmployeeName: name,
          Amount:       amount,
          TransType:    amount >= 0 ? 'Earn' : 'Spend',
          Source:       source,
          RefDocID:     refDocID || '',
          Description:  desc,
          RefDate:      refDateStr,
          CoinReaders: [employeeID, name + '/O=XRedSchool', '[NLK_SysAdmin]'],
          CoinAuthors:  ['[NLK_SysAdmin]'],
        };
        // 不帶 computewithform：FNLKT05 欄位全是 editable，不需要伺服器端計算
        // 省略可避免 Domino 對 datetime/readers 欄位格式過嚴的 400 錯誤
        await axios.post(`${DOCS}?form=FNLKT05&computewithform=true`, body);
      } catch (e) { console.warn('[NovaLink] 發放活力幣失敗', source, e); }
    },

    async afterCreate(page, msg) {
      this.modal = null;
      this.toast(msg);
      await this.refreshAll();
      this.currentPage = page;
    },
    failSubmit(e) {
      console.error('[NovaLink] 送出失敗', e);
      const code = e?.response?.status;
      const detail = e?.response?.data?.message || e?.response?.data?.text || '';
      this.modalError = `送出失敗（${code || '連線錯誤'}）。${detail ? detail + '。' : ''}可改用下方「Notes 表單」填寫。`;
    },

    /* ---------- 顯示輔助 ---------- */
    toast(msg) { this.toastMsg = msg; setTimeout(() => { this.toastMsg = ''; }, 2800); },
    fmt(n) { const v = Number(n)||0; return v.toLocaleString('en-US'); },
    cnName(name) {
      if (!name) return '';
      let s = name; const slash = s.indexOf('/');
      if (slash > 0) s = s.substring(0, slash);
      if (s.indexOf('CN=') === 0) s = s.substring(3);
      return s;
    },
    moodEmoji(s) { return ({'1':'😢','2':'😕','3':'😐','4':'🙂','5':'😄'})[s] || '😐'; },
    moodLabel(s) { return ({'1':'很低落','2':'有點悶','3':'普通','4':'不錯','5':'超棒'})[s] || '—'; },
    stressColor(l) { return ({'1':'#34d399','2':'#a3e635','3':'#fbbf24','4':'#fb923c','5':'#fb7185'})[l] || '#94a3b8'; },
    statusLabel(s) {
      return ({Draft:'草稿',Open:'募資中',Pending:'達標待審',Review:'審核中',Approved:'已採用',Rejected:'已退回'})[s] || s;
    },
    pct(cur, tar) {
      const t = Number(tar)||0; if (t <= 0) return '0%';
      return Math.min(Math.round((Number(cur)||0)/t*100), 100) + '%';
    },
    sourceLabel(s) {
      return ({
        MoodEntry:'每日情緒', MoodStreak:'連續登入',
        ThanksCard_Send:'送出感謝卡', ThanksCard_Recv:'收到感謝卡', Featured:'精選感謝卡',
        Proposal_Submit:'提出提案', Proposal_Funded:'提案達標', Proposal_Adopted:'提案採用',
        ProposalInvest:'投資提案',
      })[s] || s || '—';
    },
    fmtDateTime(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d)) return String(v);
      const p = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    todayCandidates() {
      const d = new Date(), y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
      const p = n => String(n).padStart(2,'0');
      return [ `${y}/${m}/${day}`, `${y}/${p(m)}/${p(day)}`, `${y}-${p(m)}-${p(day)}` ];
    },
  },
}).mount('#app');