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
        { id:'shop',     icon:'🛒', label:'商城' },
        { id:'bounty', icon:'🎯', label:'懸賞板' },
        { id:'profile', icon:'👤', label:'個人頁面' },
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
      // 商城
      shopPurchases: [],
      shopBuying: null,
      shopItems: [
        { id:'title_vip', name:'⭐ VIP 專屬稱號',   price:20, type:'virtual', desc:'在名字旁顯示閃亮的 VIP 徽章。', once:true },
        { id:'title_pro', name:'🏆 Pro 達人稱號',   price:25, type:'virtual', desc:'展現你的專業實力，名字旁顯示 Pro 標誌。', once:true },
        { id:'late_pass', name:'😴 遲到免責券',      price:50, type:'privilege', desc:'使用一次可免除遲到紀錄，限用一次。', once:false },
        { id:'flex_work', name:'🏠 彈性上班券',      price:40, type:'privilege', desc:'兌換一天在家上班的機會。', once:false },
        { id:'coffee',    name:'☕ 咖啡兌換券',      price:15, type:'privilege', desc:'至公司咖啡吧免費兌換一杯飲品。', once:false },
      ],
      // 懸賞板
      bountyList: [],
      bountyCategories: ['程式開發','文件撰寫','設計美工','翻譯校稿','資料整理','其他'],
      bountyForm: { TaskTitle:'', TaskDesc:'', TaskCategory:'', BountyAmount:10 },
      // toast
      toastMsg: '',
      darkMode: false,
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
      return { mood:'填寫今日情緒', thanks:'發送感謝卡', proposal:'提出新提案', invest:'投資創新提案', bounty:'發布懸賞任務' }[this.modal] || '';
    },
    ownedItemIds() {
    return this.shopPurchases.map(p => p.ItemID);
    },
    isDarkMode() {
      return this.darkMode;
    },
    userTitle() {
      if (this.ownedItemIds.includes('title_vip')) return '⭐ VIP';
      if (this.ownedItemIds.includes('title_pro')) return '🏆 Pro';
      return '';
    },
    // 技能雷達圖：統計「收到的」感謝卡各類型數量
    skillRadar() {
      const cats = ['🤝 神隊友','🚒 救火英雄','💡 好點子','🌐 跨部門合作','💛 溫暖鼓勵'];
      const labels = ['神隊友','救火英雄','好點子','跨部門合作','溫暖鼓勵'];
      const me = this.currentUser ? this.cnName(this.currentUser) : '';
      const counts = cats.map(cat =>
        this.thanksList.filter(c => c.RecipientName === me && c.CardType === cat).length
      );
      const max = Math.max(...counts, 1);
      return { labels, counts, max };
    },
    radarPoints() {
      const { counts, max } = this.skillRadar;
      const cx = 140, cy = 140, r = 110;
      const n = 5;
      return counts.map((v, i) => {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
        const ratio = v / max;
        const x = cx + r * ratio * Math.cos(angle);
        const y = cy + r * ratio * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    },
    radarLabelPositions() {
      const cx = 140, cy = 140, r = 130;
      const n = 5;
      return this.skillRadar.labels.map((label, i) => {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
        return {
          label,
          count: this.skillRadar.counts[i],
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          anchor: i === 0 ? 'middle' : (i < 3 ? 'start' : 'end'),
        };
      });
    },
    profileStats() {
      const me = this.currentUser ? this.cnName(this.currentUser) : '';
      const sent = this.thanksList.filter(c => c.SenderName === me).length;
      const received = this.thanksList.filter(c => c.RecipientName === me).length;
      const proposals = this.proposalList.filter(p => p.ProposerName === me).length;
      const moodDays = this.moodList.length;
      return { sent, received, proposals, moodDays };
    },
  },

  mounted() {
    this._clockTimer = setInterval(() => { this.now = new Date(); }, 1000);
    this.loadCurrentUser();
    this.refreshAll();
    this.darkMode = localStorage.getItem('nlk_dark') === '1';
    if (this.darkMode) document.documentElement.classList.add('dark');
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
      if (id === 'shop') this.loadShopPurchases();
      if (id === 'bounty') this.loadBounty();
    },
    async refreshAll() {
      this.loading = true; this.errorMsg = '';
      await Promise.all([ this.loadMood(), this.loadThanks(), this.loadProposal(), this.loadCoin(), this.loadShopPurchases(), this.loadBounty() ]);
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
    toggleDark() {
      this.darkMode = !this.darkMode;
      document.documentElement.classList.toggle('dark', this.darkMode);
      localStorage.setItem('nlk_dark', this.darkMode ? '1' : '0');
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
      if (name === 'bounty') this.bountyForm = { TaskTitle:'', TaskDesc:'', TaskCategory:'', BountyAmount:10 };
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
      if (this.modal === 'bounty') return this.submitBounty();
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
        const recipID = 'CN=' + f.RecipientID.trim() + '/O=XRedSchool';
        const body = {
          RecipientID: recipID,
          CardType:    f.CardType,
          CardMessage: f.CardMessage,
          IsPublic:    f.IsPublic ? '1' : '0',
        };
        const unid = await this.createDoc('FNLKM02', body);
        const sender = await this.ownerOf(unid, 'SenderID');
        await this.issueCoin(sender,            2, 'ThanksCard_Send', unid, `發送感謝卡（${f.CardType}）`);
        await this.issueCoin(recipID,3, 'ThanksCard_Recv', unid, `收到感謝卡（${f.CardType}）`);
        await this.afterCreate('thanks', '感謝卡已送出，+2 活力幣！');
      } catch (e) { this.failSubmit(e); }
      this.submitting = false;
    },

    async submitProposal() {
      const f = this.proposalForm;
      if (!f.ProposalTitle.trim()) { this.modalError = '請輸入提案標題。'; return; }
      if (this.balance < 5) { this.modalError = '活力幣不足！提案需要 5 活力幣，目前餘額 ' + this.balance + '。'; return; }
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
        await this.issueCoin(me, -5, 'Proposal_Submit', unid, `提出創新提案：${f.ProposalTitle.trim()}`);
        await this.afterCreate('proposal', '提案已公開，-5 活力幣！如提案達標將會返還活力幣！');
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
          await this.issueCoin(p.ProposerID, 55, 'Proposal_Funded', parentUnid, `提案達標：${p.ProposalTitle}`);
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
    async likeCard(card) {
      if (!this.currentUser) { this.toast('請先操作任一功能以識別身份'); return; }
      card._liking = true;
      try {
        // 讀取完整文件，檢查是否已按讚
        const r = await axios.get(`${DOCS}/unid/${card['@unid']}`);
        const doc = r.data;
        const likedBy = doc.LikedBy || '';
        const likers = likedBy ? likedBy.split(',') : [];
        const me = this.cnName(this.currentUser);

        if (likers.includes(me)) {
          this.toast('你已經按過讚了！');
          card._liking = false;
          return;
        }

        // 更新按讚數和按讚者
        likers.push(me);
        const newCount = (Number(doc.LikeCount) || 0) + 1;
        await axios.patch(`${DOCS}/unid/${card['@unid']}`, {
          LikeCount: newCount,
          LikedBy: likers.join(',')
        });

        // 發幣給發卡人和收卡人各 +1
        if (doc.SenderID)    await this.issueCoin(doc.SenderID, 1, 'CardLike', card['@unid'], '感謝卡被按讚');
        if (doc.RecipientID) await this.issueCoin(doc.RecipientID, 1, 'CardLike', card['@unid'], '感謝卡被按讚');

        // 更新前端顯示
        card.LikeCount = newCount;
        this.toast(`已按讚！${this.cnName(doc.SenderName || '')} 和 ${this.cnName(doc.RecipientName || '')} 各獲得 +1 活力幣`);
      } catch (e) {
        console.warn('按讚失敗', e);
        this.toast('按讚失敗，請稍後再試');
      }
      card._liking = false;
    },
    async loadShopPurchases() {
      try {
        const r = await axios.get(`${COLL}/VNLKM60?count=100`);
        this.shopPurchases = this.docsOnly(r.data);
      } catch (e) { console.warn('載入商城購買紀錄失敗', e); }
    },

    canBuyItem(item) {
      if (item.once && this.ownedItemIds.includes(item.id)) return false;
      if (this.balance < item.price) return false;
      return true;
    },

    buyItemLabel(item) {
      if (item.once && this.ownedItemIds.includes(item.id)) return '已擁有';
      if (this.balance < item.price) return '餘額不足';
      return `${item.price} 幣購買`;
    },

    async buyItem(item) {
      if (!this.currentUser) { this.toast('請先操作任一功能以識別身份'); return; }
      if (!this.canBuyItem(item)) return;
      if (!confirm(`確定要花費 ${item.price} 活力幣購買「${item.name}」嗎？`)) return;

      try {
        const nd = new Date();
        const p = n => String(n).padStart(2,'0');
        const dateStr = `${nd.getFullYear()}/${p(nd.getMonth()+1)}/${p(nd.getDate())} ${p(nd.getHours())}:${p(nd.getMinutes())}:${p(nd.getSeconds())}`;
        const name = this.cnName(this.currentUser);

        const body = {
          BuyerID:      this.currentUser,
          BuyerName:    name,
          ItemID:       item.id,
          ItemName:     item.name,
          ItemPrice:    item.price,
          ItemType:     item.type,
          PurchaseDate: dateStr,
        };
        await axios.post(`${DOCS}?form=FNLKM06`, body);
        await this.issueCoin(this.currentUser, -item.price, 'ShopPurchase', '', `商城購買：${item.name}`);
        await this.refreshAll();
        this.toast(`成功購買「${item.name}」！`);
      } catch (e) {
        console.warn('購買失敗', e);
        this.toast('購買失敗，請稍後再試');
      }
    },
    async loadBounty() {
      try {
        const r = await axios.get(`${COLL}/VNLKM70?count=100`);
        this.bountyList = this.docsOnly(r.data);
      } catch (e) { console.warn('載入懸賞板失敗', e); }
    },

    async submitBounty() {
      const f = this.bountyForm;
      if (!f.TaskTitle.trim()) { this.modalError = '請輸入任務標題。'; return; }
      const amt = Number(f.BountyAmount);
      if (!amt || amt < 1) { this.modalError = '懸賞金額至少 1 幣。'; return; }
      if (amt > this.balance) { this.modalError = `活力幣不足！目前餘額 ${this.balance}，需要 ${amt} 幣。`; return; }
      if (!this.currentUser) { this.modalError = '請先操作任一功能以識別身份。'; return; }
      this.submitting = true; this.modalError = '';
      try {
        const nd = new Date();
        const p = n => String(n).padStart(2,'0');
        const dateStr = `${nd.getFullYear()}/${p(nd.getMonth()+1)}/${p(nd.getDate())} ${p(nd.getHours())}:${p(nd.getMinutes())}:${p(nd.getSeconds())}`;
        const name = this.cnName(this.currentUser);
        const body = {
          PosterID:     this.currentUser,
          PosterName:   name,
          TaskTitle:    f.TaskTitle.trim(),
          TaskDesc:     f.TaskDesc,
          TaskCategory: f.TaskCategory || '其他',
          BountyAmount: amt,
          Status:       'Open',
          AcceptorID:   '',
          AcceptorName: '',
          CreateDateStr: dateStr.substring(0,10),
        };
        const unid = await this.createDoc('FNLKM07', body);
        await this.issueCoin(this.currentUser, -amt, 'BountyEscrow', unid, `懸賞託管：${f.TaskTitle.trim()}`);
        await this.afterCreate('bounty', `懸賞已發布！${amt} 活力幣已託管。`);
      } catch (e) { this.failSubmit(e); }
      this.submitting = false;
    },

    bountyStatusLabel(s) {
      return ({Open:'徵求中', Accepted:'進行中', Completed:'已完成', Cancelled:'已取消'})[s] || s;
    },

    isMyBounty(b) {
      return this.currentUser && b.PosterID && b.PosterID === this.currentUser;
    },

    async acceptBounty(b) {
      if (!this.currentUser) { this.toast('請先操作任一功能以識別身份'); return; }
      if (this.isMyBounty(b)) { this.toast('不能接自己發的懸賞！'); return; }
      if (!confirm(`確定要接下「${b.TaskTitle}」這個任務嗎？`)) return;
      try {
        const name = this.cnName(this.currentUser);
        await axios.patch(`${DOCS}/unid/${b['@unid']}`, {
          Status: 'Accepted',
          AcceptorID: this.currentUser,
          AcceptorName: name,
        });
        this.toast('已接單！完成後等待發包人確認。');
        await this.loadBounty();
      } catch (e) {
        console.warn('接單失敗', e);
        this.toast('接單失敗，請稍後再試');
      }
    },

    async completeBounty(b) {
      if (!confirm(`確認「${this.cnName(b.AcceptorName || b.AcceptorID)}」已完成任務？${b.BountyAmount} 幣將轉給對方。`)) return;
      try {
        await axios.patch(`${DOCS}/unid/${b['@unid']}`, { Status: 'Completed' });
        await this.issueCoin(b.AcceptorID, Number(b.BountyAmount), 'BountyReward', b['@unid'], `完成懸賞：${b.TaskTitle}`);
        this.toast(`任務完成！${b.BountyAmount} 幣已轉給 ${this.cnName(b.AcceptorName || b.AcceptorID)}。`);
        await this.refreshAll();
      } catch (e) {
        console.warn('確認完成失敗', e);
        this.toast('操作失敗，請稍後再試');
      }
    },

    async cancelBounty(b) {
      if (!confirm(`確定取消懸賞「${b.TaskTitle}」嗎？${b.BountyAmount} 幣將退還給你。`)) return;
      try {
        await axios.patch(`${DOCS}/unid/${b['@unid']}`, { Status: 'Cancelled' });
        await this.issueCoin(this.currentUser, Number(b.BountyAmount), 'BountyRefund', b['@unid'], `懸賞取消退款：${b.TaskTitle}`);
        this.toast(`懸賞已取消，${b.BountyAmount} 幣已退還。`);
        await this.refreshAll();
      } catch (e) {
        console.warn('取消失敗', e);
        this.toast('操作失敗，請稍後再試');
      }
    },
    radarGridPoints(level) {
      const cx = 140, cy = 140, r = 110;
      const n = 5;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
        const x = cx + r * level * Math.cos(angle);
        const y = cy + r * level * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(' ');
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
        ShopPurchase:'商城購買',
        BountyEscrow:'懸賞託管', BountyReward:'懸賞獎勵', BountyRefund:'懸賞退款',
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