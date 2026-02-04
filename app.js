// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC3Hyi-tVMui0ZyPsezvoxxSFjCJQBme9Q",
    authDomain: "ss-app-87ac7.firebaseapp.com",
    projectId: "ss-app-87ac7",
    storageBucket: "ss-app-87ac7.firebasestorage.app",
    messagingSenderId: "7671656513",
    appId: "1:7671656513:web:21b51edb450bddd1aad6c0",
    measurementId: "G-LQPLFRBGKH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const studentsCollection = collection(db, "students");

// Store and Logic (Async)
const store = {
    students: [], // Local cache

    async init() {
        // Fetch initial data
        try {
            const q = query(studentsCollection, orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            this.students = [];
            querySnapshot.forEach((doc) => {
                this.students.push({ id: doc.id, ...doc.data() });
            });
            console.log("Students loaded:", this.students.length);
            renderList();
        } catch (e) {
            console.error("Error loading students:", e);
            alert("فشل تحميل البيانات من قاعدة البيانات. تحقق من الاتصال بالإنترنت.");
        }
    },

    async add(student) {
        // Validation: Unique based on Reg Number AND Page Number
        const exists = this.students.some(s => s.regNumber === student.regNumber && s.pageNumber === student.pageNumber);
        if (exists) {
            alert('خطأ: هذا القيد مسجل في نفس الصفحة مسبقاً!');
            return false;
        }

        // Warning: Duplicate Name
        const sLast = (student.lastName || '').trim();
        const sFirst = student.firstName.trim();

        const duplicateName = this.students.find(s =>
            s.firstName.trim() === sFirst &&
            (s.lastName || '').trim() === sLast
        );

        if (duplicateName) {
            alert(`تنبيه: هذا الاسم مسجل مسبقاً!\nالقيد: ${duplicateName.regNumber}\nالصفحة: ${duplicateName.pageNumber}`);
        }

        const newStudent = {
            createdAt: Date.now(),
            firstName: sFirst,
            lastName: sLast,
            regNumber: student.regNumber,
            pageNumber: student.pageNumber,
            notes: (student.notes || '').trim()
        };

        try {
            const docRef = await addDoc(studentsCollection, newStudent);
            // Update local cache immediately for UI responsiveness
            this.students.unshift({ id: docRef.id, ...newStudent });
            return true;
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("فشل الحفظ في قاعدة البيانات.");
            return false;
        }
    },

    async update(id, updatedData) {
        const studentRef = doc(db, "students", id);

        // Validation: Unique based on Reg + Page (excluding current)
        const exists = this.students.some(s =>
            s.id !== id &&
            s.regNumber === updatedData.regNumber &&
            s.pageNumber === updatedData.pageNumber
        );

        if (exists) {
            alert('خطأ: هذا القيد مسجل في نفس الصفحة مسبقاً!');
            return false;
        }

        const sLast = (updatedData.lastName || '').trim();
        const sFirst = updatedData.firstName.trim();
        const notes = (updatedData.notes || '').trim();

        try {
            await updateDoc(studentRef, {
                firstName: sFirst,
                lastName: sLast,
                regNumber: updatedData.regNumber,
                pageNumber: updatedData.pageNumber,
                notes: notes
            });

            // Update local cache
            const index = this.students.findIndex(s => s.id === id);
            if (index !== -1) {
                this.students[index] = {
                    ...this.students[index],
                    firstName: sFirst,
                    lastName: sLast,
                    regNumber: updatedData.regNumber,
                    pageNumber: updatedData.pageNumber,
                    notes: notes
                };
            }
            return true;

        } catch (e) {
            console.error("Error updating document: ", e);
            alert("فشل التعديل في قاعدة البيانات.");
            return false;
        }
    },

    async delete(id) {
        try {
            await deleteDoc(doc(db, "students", id));
            this.students = this.students.filter(s => s.id !== id);
        } catch (e) {
            console.error("Error removing document: ", e);
            alert("فشل الحذف من قاعدة البيانات.");
        }
    },

    async deleteAll() {
        try {
            // Firestore doesn't have a native "delete collection" method for web client easily.
            // We must delete documents one by one or in batches.
            // For safety and simplicity with small datasets: loop.
            // For larger datasets, batching is required (limit 500).

            const batchSize = 500;
            const chunks = [];
            for (let i = 0; i < this.students.length; i += batchSize) {
                chunks.push(this.students.slice(i, i + batchSize));
            }

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(s => {
                    const ref = doc(db, "students", s.id);
                    batch.delete(ref);
                });
                await batch.commit();
            }

            this.students = [];
        } catch (e) {
            console.error("Error deleting all: ", e);
            alert("حدث خطأ أثناء حذف البيانات.");
            // Reload to sync state in case of partial failure
            this.init();
        }
    },

    get(id) {
        return this.students.find(s => s.id === id);
    }
};

// UI Helpers (Exported to window for HTML access)
window.ui = {
    showPrintModal() {
        document.getElementById('printModal').classList.remove('hidden');
    },

    closePrintModal() {
        document.getElementById('printModal').classList.add('hidden');
        document.getElementById('printRegInput').value = '';
    },

    printAll() {
        // 1. Get ALL students sorted alphabetically
        const sortedStudents = [...store.students].sort((a, b) =>
            a.firstName.localeCompare(b.firstName)
        );

        const container = document.getElementById('print-table-container');
        const ROWS_PER_COLUMN = 30;
        const COLUMNS_PER_PAGE = 2;
        const ITEMS_PER_PAGE = ROWS_PER_COLUMN * COLUMNS_PER_PAGE;

        let htmlContent = '';

        for (let i = 0; i < sortedStudents.length; i += ITEMS_PER_PAGE) {
            const pageStudents = sortedStudents.slice(i, i + ITEMS_PER_PAGE);
            htmlContent += `<div class="print-page">`;
            for (let j = 0; j < COLUMNS_PER_PAGE; j++) {
                const colStartIndex = j * ROWS_PER_COLUMN;
                const colStudents = pageStudents.slice(colStartIndex, colStartIndex + ROWS_PER_COLUMN);
                htmlContent += `<div class="print-column">`;
                if (colStudents.length > 0) {
                    htmlContent += `
                        <table class="print-table">
                            <thead>
                                <tr>
                                    <th class="col-seq">التسلسل</th>
                                    <th class="col-name">الاسم الكامل</th>
                                    <th class="col-reg">ق</th>
                                    <th class="col-page">ص</th>
                                </tr>
                            </thead>
                            <tbody>
                     `;
                    colStudents.forEach((s, idx) => {
                        const globalIndex = i + colStartIndex + idx + 1;
                        htmlContent += `
                            <tr>
                                <td class="col-seq">${globalIndex}</td>
                                <td>${s.firstName} ${s.lastName ? '/ ' + s.lastName : ''}</td>
                                <td class="col-reg">${s.regNumber}</td>
                                <td class="col-page">${s.pageNumber}</td>
                            </tr>
                         `;
                    });
                    htmlContent += `</tbody></table>`;
                }
                htmlContent += `</div>`;
            }
            htmlContent += `</div>`;
        }
        container.innerHTML = htmlContent;
        this.closePrintModal();
        setTimeout(() => { window.print(); }, 500);
    },

    printByReg() {
        const reg = document.getElementById('printRegInput').value.trim();
        if (!reg) return;

        const searchInput = document.getElementById('searchInput');
        const originalSearch = searchInput.value;
        const filterRegCheckbox = document.getElementById('filterReg');
        const originalFilterReg = filterRegCheckbox.checked;

        searchInput.value = reg;
        if (filterRegCheckbox) filterRegCheckbox.checked = true;
        renderList();

        this.closePrintModal();

        setTimeout(() => {
            window.print();
            searchInput.value = originalSearch;
            if (filterRegCheckbox) filterRegCheckbox.checked = originalFilterReg;
            renderList();
        }, 500);
    }
};

// Router (Exported for HTML access)
window.router = {
    routes: ['list', 'add', 'detail', 'settings', 'edit'],

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },

    navigate(view, id = null) {
        window.location.hash = id ? `${view}/${id}` : view;
    },

    handleRoute() {
        const hash = window.location.hash.slice(1) || 'list';
        const [view, id] = hash.split('/');
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const viewEl = document.getElementById(`view-${view}`);
        if (viewEl) {
            viewEl.classList.add('active');
            if (view === 'list') renderList();
            if (view === 'detail' && id) renderDetail(id);
            if (view === 'edit' && id) renderEdit(id);
        }
    }
};

// Render Functions
function renderStats(uniqueStudents, totalRecords, pages) {
    const dashboard = document.getElementById('statsDashboard');
    if (!dashboard) return;

    dashboard.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            </div>
            <div class="stat-info">
                <h4>إجمالي الطلاب (الفعلي)</h4>
                <div class="value">${uniqueStudents}</div>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon" style="color: var(--accent); background: var(--accent-soft);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            </div>
            <div class="stat-info">
                <h4>عدد القيود</h4>
                <div class="value">${totalRecords}</div>
            </div>
        </div>

        <div class="stat-card">
            <div class="stat-icon" style="color: #10b981; background: #d1fae5;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                   <line x1="8" y1="21" x2="16" y2="21"></line>
                   <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
            </div>
            <div class="stat-info">
                <h4>الصفحات المستخدمة</h4>
                <div class="value">${pages}</div>
            </div>
        </div>
    `;
}

function renderList() {
    const grid = document.getElementById('studentGrid');
    const empty = document.getElementById('emptyState');
    const input = document.getElementById('searchInput');
    const filterReg = document.getElementById('filterReg') && document.getElementById('filterReg').checked;
    const sortBy = document.getElementById('sortBy') ? document.getElementById('sortBy').value : 'recent';
    const query = input ? input.value.toLowerCase() : '';

    let result = store.students.filter(s => {
        if (!query) return true;
        if (filterReg) {
            return s.regNumber.toLowerCase() === query;
        }
        return s.firstName.toLowerCase().includes(query) ||
            s.lastName.toLowerCase().includes(query) ||
            s.regNumber.toLowerCase().includes(query);
    });

    // Calculate Stats
    const totalRecords = store.students.length;
    const uniqueStudents = new Set(store.students.map(s => s.regNumber.toString().trim())).size;

    const validPages = new Set(store.students
        .map(s => s.pageNumber ? s.pageNumber.toString().trim() : '')
        .filter(p => p !== '')
    ).size;

    renderStats(uniqueStudents, totalRecords, validPages);

    // Sort
    if (sortBy === 'alphabetical') {
        result.sort((a, b) => a.firstName.localeCompare(b.firstName));
    } else {
        result.sort((a, b) => b.createdAt - a.createdAt);
    }

    if (result.length === 0) {
        grid.style.display = 'none';
        empty.classList.remove('hidden');
        if (store.students.length > 0 && query) {
            empty.querySelector('h3').textContent = 'لا توجد نتائج بحث';
            empty.querySelector('p').textContent = 'جرب البحث بكلمات مختلفة';
        }
    } else {
        grid.style.display = 'grid';
        empty.classList.add('hidden');

        const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

        grid.innerHTML = result.map(s => {
            const colorIndex = (parseInt(s.pageNumber) || 0) % colors.length;
            const barColor = colors[colorIndex];

            return `
            <div class="card" onclick="router.navigate('detail', '${s.id}')">
                <div class="card-bar" style="background: ${barColor}"></div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                    <span class="page-badge">صـفحة ${s.pageNumber}</span>
                </div>
                <h3 style="font-size:1.25rem; font-weight:800; color:var(--primary);">
                    ${s.firstName} ${s.lastName ? '<span style="color:var(--accent); font-weight:400; margin:0 4px;">/</span> ' + s.lastName : ''}
                </h3>
                <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; color:var(--text-muted);">رقم القيد</span>
                    <span style="font-family:monospace; font-weight:700; background:#f1f5f9; padding:0.1rem 0.5rem; border-radius:4px;">${s.regNumber}</span>
                </div>
            </div>
        `}).join('');
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString('ar-EG', { calendar: 'gregory' });
}

function renderDetail(id) {
    const student = store.get(id);
    const container = document.getElementById('detailContent');

    if (!student) {
        container.innerHTML = '<div style="padding:2rem; text-align:center;">الطالب غير موجود</div>';
        return;
    }

    container.innerHTML = `
        <div style="height: 6px; background: linear-gradient(to right, var(--primary), var(--primary-light));"></div>
        <div class="detail-header">
            <div>
                <h1 style="font-size:1.75rem; margin-bottom:0.25rem; color:var(--primary);">${student.firstName} ${student.lastName}</h1>
                <p style="color:var(--text-muted); font-size:0.875rem;">تاريخ الإضافة: ${formatDate(student.createdAt)}</p>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button onclick="router.navigate('edit', '${student.id}')" style="padding:0.5rem; background:#f0f9ff; color:var(--primary); border:none; border-radius:50%; cursor:pointer;" title="تعديل">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onclick="window.print()" style="padding:0.5rem; background:#f1f5f9; border:none; border-radius:50%; cursor:pointer;" title="طباعة">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                </button>
                <button onclick="actions.delete('${student.id}')" style="padding:0.5rem; background:#fee2e2; color:#ef4444; border:none; border-radius:50%; cursor:pointer;" title="حذف">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>
        <div class="detail-body">
            <div class="info-grid">
                <div class="info-box" style="background: rgba(30, 58, 138, 0.05); border-color: rgba(30, 58, 138, 0.1);">
                    <span class="label">رقم القيد</span>
                    <div class="value">${student.regNumber}</div>
                </div>
                <div class="info-box" style="background: rgba(217, 119, 6, 0.05); border-color: rgba(217, 119, 6, 0.1);">
                    <span class="label">رقم الصفحة</span>
                    <div class="value">${student.pageNumber}</div>
                </div>
                <div>
                    <span class="label">الاسم الأول</span>
                    <div style="font-size:1.1rem; font-weight:600;">${student.firstName}</div>
                </div>
                <div>
                    <span class="label">اللقب</span>
                    <div style="font-size:1.1rem; font-weight:600;">${student.lastName}</div>
                </div>
            </div>
            
            ${student.notes ? `
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border);">
                <span class="label" style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    الملاحظات
                </span>
                <div style="background: #fffbeb; border: 1px solid #fcd34d; padding: 1rem; border-radius: var(--radius-md); font-size: 1rem; line-height: 1.6; white-space: pre-wrap;">${student.notes}</div>
            </div>
            ` : ''}
        </div>
    `;
}

function renderEdit(id) {
    const student = store.get(id);
    if (!student) {
        window.router.navigate('list');
        return;
    }

    // Fill the Edit Form
    document.getElementById('edit_id').value = student.id;
    document.querySelector('#editForm [name="firstName"]').value = student.firstName;
    document.querySelector('#editForm [name="lastName"]').value = student.lastName;
    document.querySelector('#editForm [name="regNumber"]').value = student.regNumber;
    document.querySelector('#editForm [name="pageNumber"]').value = student.pageNumber;
    document.querySelector('#editForm [name="notes"]').value = student.notes || '';
}

// User Actions (Exported)
window.actions = {
    async delete(id) {
        if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
            await store.delete(id);
            window.router.navigate('list');
            renderList();
        }
    },

    async deleteAll() {
        if (confirm('تحذير: هل أنت متأكد تماماً من حذف جميع سجلات الطلاب؟\nلا يمكن التراجع عن هذا الإجراء!')) {
            if (confirm('تأكيد نهائي: سيتم مسح كافة البيانات من السحابة.\nهل تريد الاستمرار؟')) {
                await store.deleteAll();
                alert('تم حذف جميع السجلات بنجاح');
                window.router.navigate('list');
                renderList();
            }
        }
    },

    exportExcel() {
        if (!store.students.length) {
            alert('لا توجد بيانات للتصدير');
            return;
        }

        try {
            const worksheet = XLSX.utils.json_to_sheet(store.students.map(s => ({
                'الاسم الأول': s.firstName,
                'اللقب': s.lastName,
                'رقم القيد': s.regNumber,
                'رقم الصفحة': s.pageNumber,
                'الملاحظات': s.notes || '',
                'تاريخ الإضافة': formatDate(s.createdAt)
            })));

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");

            XLSX.writeFile(workbook, "سجل_الطلاب.xlsx");
        } catch (e) {
            alert('حدث خطأ أثناء التصدير: ' + e.message);
        }
    },

    importExcel(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                let count = 0;
                let skipped = 0;

                // Process sequentially for database safety
                for (const row of jsonData) {
                    const firstName = row['firstName'] || row['الاسم الأول'];
                    const lastName = row['lastName'] || row['اللقب'];
                    const regNumber = row['regNumber'] || row['رقم القيد'];
                    const pageNumber = row['pageNumber'] || row['رقم الصفحة'];
                    const notes = row['notes'] || row['الملاحظات'] || '';

                    if (firstName && lastName && regNumber) {
                        const pageStr = pageNumber ? pageNumber.toString() : '';
                        const regStr = regNumber.toString();

                        const exists = store.students.some(s =>
                            s.regNumber === regStr &&
                            s.pageNumber === pageStr
                        );

                        if (!exists) {
                            await store.add({
                                firstName,
                                lastName,
                                regNumber: regStr,
                                pageNumber: pageStr,
                                notes: notes
                            });
                            count++;
                        } else {
                            skipped++;
                        }
                    }
                }

                let msg = `تم استيراد ${count} سجل بنجاح.`;
                if (skipped > 0) msg += `\nتم تخطي ${skipped} سجل لوجود رقم قيد مكرر.`;
                alert(msg);

                input.value = '';
                window.router.navigate('list');
                renderList();
            } catch (err) {
                alert('فشل قراءة الملف أو الحفظ.');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    store.init().then(() => {
        window.router.init();
    });

    // Add Form Handle
    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'جاري الحفظ...';
        btn.disabled = true;

        const formData = new FormData(e.target);

        const success = await store.add({
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            regNumber: formData.get('regNumber'),
            pageNumber: formData.get('pageNumber'),
            notes: formData.get('notes')
        });

        btn.textContent = originalText;
        btn.disabled = false;

        if (success) {
            e.target.reset();
            window.router.navigate('list');
            renderList();
        }
    });

    // Edit Form Handle
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'جاري الحفظ...';
            btn.disabled = true;

            const formData = new FormData(e.target);
            const id = document.getElementById('edit_id').value;

            const success = await store.update(id, {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                regNumber: formData.get('regNumber'),
                pageNumber: formData.get('pageNumber'),
                notes: formData.get('notes')
            });

            btn.textContent = originalText;
            btn.disabled = false;

            if (success) {
                window.router.navigate('detail', id);
                renderDetail(id);
            }
        });
    }

    // Search Handle
    const searchInput = document.getElementById('searchInput');
    const filterReg = document.getElementById('filterReg');

    if (searchInput) searchInput.addEventListener('input', () => renderList());
    if (filterReg) filterReg.addEventListener('change', () => renderList());

    // Live Name Check
    ['addForm', 'editForm'].forEach(formId => {
        const form = document.getElementById(formId);
        if (!form) return;

        const checkName = () => {
            const fName = form.querySelector('[name="firstName"]').value.trim().toLowerCase();
            const lName = form.querySelector('[name="lastName"]').value.trim().toLowerCase();
            const currentId = formId === 'editForm' ? document.getElementById('edit_id').value : null;

            if (!fName) return hideWarning(form);

            const matches = store.students.filter(s => {
                if (s.id === currentId) return false;

                const sFirst = s.firstName.toLowerCase();
                const sLast = (s.lastName || '').toLowerCase();

                if (!lName) {
                    return sFirst.startsWith(fName);
                }
                return sFirst === fName && sLast.startsWith(lName);
            });

            if (matches.length > 0) {
                showWarning(form, matches);
            } else {
                hideWarning(form);
            }
        };

        const inputs = form.querySelectorAll('[name="firstName"], [name="lastName"]');
        inputs.forEach(input => {
            input.addEventListener('input', checkName);
        });
    });

    function showWarning(form, matches) {
        let warning = form.querySelector('.name-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.className = 'name-warning';
            warning.style.marginTop = '0.5rem';
            warning.style.backgroundColor = '#fff';
            warning.style.border = '1px solid var(--border)';
            warning.style.borderRadius = 'var(--radius-md)';
            warning.style.boxShadow = 'var(--shadow-lg)';
            warning.style.maxHeight = '200px';
            warning.style.overflowY = 'auto';
            warning.style.zIndex = '100';

            const lNameGroup = form.querySelector('[name="lastName"]').closest('.input-group') || form.querySelector('[name="lastName"]').parentElement;
            if (lNameGroup) lNameGroup.appendChild(warning);
        }

        const topMatches = matches.slice(0, 5);
        const count = matches.length;

        let html = `
            <div style="padding: 0.5rem 0.75rem; background: #fffbeb; border-bottom: 1px solid #fcd34d; font-size: 0.85rem; color: #b45309; font-weight: 600;">
                نتائج مشابهة (${count})
            </div>
            <ul style="list-style: none; padding: 0; margin: 0;">
        `;

        topMatches.forEach(s => {
            html += `
                <li style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 500; font-size: 0.9rem; color: var(--primary);">${s.firstName} ${s.lastName}</span>
                    <span style="font-size: 0.8rem; background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px; color: var(--text-muted);">
                        قيد: ${s.regNumber} | ص: ${s.pageNumber}
                    </span>
                </li>
            `;
        });

        if (count > 5) {
            html += `<li style="padding: 0.5rem; text-align: center; font-size: 0.8rem; color: var(--text-muted);">...و ${count - 5} آخرين</li>`;
        }

        html += `</ul>`;

        warning.innerHTML = html;
        warning.style.display = 'block';
    }

    function hideWarning(form) {
        const warning = form.querySelector('.name-warning');
        if (warning) {
            warning.style.display = 'none';
        }
    }

});
