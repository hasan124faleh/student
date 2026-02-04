// Store and Logic
const store = {
    students: JSON.parse(localStorage.getItem('students') || '[]'),

    save() {
        localStorage.setItem('students', JSON.stringify(this.students));
    },

    add(student) {
        // Validation: Unique based on Reg Number AND Page Number
        const exists = this.students.some(s => s.regNumber === student.regNumber && s.pageNumber === student.pageNumber);
        if (exists) {
            alert('خطأ: هذا القيد مسجل في نفس الصفحة مسبقاً!');
            return false;
        }

        // Warning: Duplicate Name
        // Treat empty last name as empty string for comparison
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
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            firstName: sFirst,
            lastName: sLast, // Ensure it is stored
            regNumber: student.regNumber,
            pageNumber: student.pageNumber
        };
        this.students.unshift(newStudent);
        this.save();
        return true;
    },

    update(id, updatedData) {
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

        // Warning: Duplicate Name (excluding current)
        const sLast = (updatedData.lastName || '').trim();
        const sFirst = updatedData.firstName.trim();

        const duplicateName = this.students.find(s =>
            s.id !== id &&
            s.firstName.trim() === sFirst &&
            (s.lastName || '').trim() === sLast
        );

        if (duplicateName) {
            alert(`تنبيه: هذا الاسم مسجل مسبقاً!\nالقيد: ${duplicateName.regNumber}\nالصفحة: ${duplicateName.pageNumber}`);
        }

        const index = this.students.findIndex(s => s.id === id);
        if (index !== -1) {
            this.students[index] = {
                ...this.students[index],
                ...updatedData,
                firstName: sFirst,
                lastName: sLast
            };
            this.save();
            return true;
        }
        return false;
    },

    delete(id) {
        this.students = this.students.filter(s => s.id !== id);
        this.save();
    },

    deleteAll() {
        this.students = [];
        this.save();
    },

    get(id) {
        return this.students.find(s => s.id === id);
    }
};

// UI Helpers
const ui = {
    showPrintModal() {
        document.getElementById('printModal').classList.remove('hidden');
    },

    closePrintModal() {
        document.getElementById('printModal').classList.add('hidden');
        document.getElementById('printRegInput').value = '';
    },

    printAll() {
        // Save state
        const searchInput = document.getElementById('searchInput');
        const originalSearch = searchInput.value;
        const filterRegCheckbox = document.getElementById('filterReg');
        const originalFilterReg = filterRegCheckbox.checked;
        const sortBy = document.getElementById('sortBy');
        const originalSort = sortBy ? sortBy.value : 'recent';

        // Clear filters to show ALL
        searchInput.value = '';
        if (filterRegCheckbox) filterRegCheckbox.checked = false;
        renderList();

        this.closePrintModal();

        // Print then Restore
        setTimeout(() => {
            window.print();

            // Restore state
            searchInput.value = originalSearch;
            if (filterRegCheckbox) filterRegCheckbox.checked = originalFilterReg;
            if (sortBy) sortBy.value = originalSort;
            renderList();
        }, 500);
    },

    printByReg() {
        const reg = document.getElementById('printRegInput').value.trim();
        if (!reg) return;

        // Save state
        const searchInput = document.getElementById('searchInput');
        const originalSearch = searchInput.value;
        const filterRegCheckbox = document.getElementById('filterReg');
        const originalFilterReg = filterRegCheckbox.checked;

        // Apply filter
        searchInput.value = reg;
        if (filterRegCheckbox) filterRegCheckbox.checked = true;
        renderList();

        this.closePrintModal();

        // Wait for render then print
        setTimeout(() => {
            window.print();

            // Restore
            searchInput.value = originalSearch;
            if (filterRegCheckbox) filterRegCheckbox.checked = originalFilterReg;
            renderList();
        }, 500);
    }
};

// Router
const router = {
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

        // Hide all views
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

        // Show current view
        const viewEl = document.getElementById(`view-${view}`);
        if (viewEl) {
            viewEl.classList.add('active');

            // Trigger lifecycle actions
            if (view === 'list') renderList();
            if (view === 'detail' && id) renderDetail(id);
            if (view === 'edit' && id) renderEdit(id);
        }
    }
};

// Render Functions
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
            return s.regNumber.toLowerCase() === query; // Exact match for print/filter by reg
        }
        return s.firstName.toLowerCase().includes(query) ||
            s.lastName.toLowerCase().includes(query) ||
            s.regNumber.toLowerCase().includes(query);
    });

    // Sort
    if (sortBy === 'alphabetical') {
        result.sort((a, b) => a.firstName.localeCompare(b.firstName));
    } else {
        result.sort((a, b) => b.createdAt - a.createdAt);
    }

    // Update Stats
    document.getElementById('totalStudents').textContent = store.students.length;
    const uniquePages = new Set(store.students.map(s => s.pageNumber)).size;
    document.getElementById('totalPages').textContent = uniquePages;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-EG');

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

        // Colors for card bars based on page number to add visual variety
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
        </div>
    `;
}

function renderEdit(id) {
    const student = store.get(id);
    if (!student) {
        router.navigate('list');
        return;
    }

    // Fill the Edit Form
    document.getElementById('edit_id').value = student.id;
    document.querySelector('#editForm [name="firstName"]').value = student.firstName;
    document.querySelector('#editForm [name="lastName"]').value = student.lastName;
    document.querySelector('#editForm [name="regNumber"]').value = student.regNumber;
    document.querySelector('#editForm [name="pageNumber"]').value = student.pageNumber;
}


// User Actions
const actions = {
    delete(id) {
        if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
            store.delete(id);
            router.navigate('list');
        }
    },

    deleteAll() {
        if (confirm('تحذير: هل أنت متأكد تماماً من حذف جميع سجلات الطلاب؟\nلا يمكن التراجع عن هذا الإجراء!')) {
            if (confirm('تأكيد نهائي: سيتم مسح كافة البيانات.\nهل تريد الاستمرار؟')) {
                store.deleteAll();
                alert('تم حذف جميع السجلات بنجاح');
                router.navigate('list');
                renderList(); // Ensure list updates
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
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                let count = 0;
                let skipped = 0;

                jsonData.forEach(row => {
                    const firstName = row['firstName'] || row['الاسم الأول'];
                    const lastName = row['lastName'] || row['اللقب'];
                    const regNumber = row['regNumber'] || row['رقم القيد'];
                    const pageNumber = row['pageNumber'] || row['رقم الصفحة'];

                    if (firstName && lastName && regNumber) {
                        // Manual check based on Reg + Page
                        const pageStr = pageNumber ? pageNumber.toString() : '';
                        const regStr = regNumber.toString();

                        const exists = store.students.some(s =>
                            s.regNumber === regStr &&
                            s.pageNumber === pageStr
                        );

                        if (!exists) {
                            store.add({
                                firstName,
                                lastName,
                                regNumber: regStr,
                                pageNumber: pageStr
                            });
                            count++;
                        } else {
                            skipped++;
                        }
                    }
                });

                let msg = `تم استيراد ${count} سجل بنجاح.`;
                if (skipped > 0) msg += `\nتم تخطي ${skipped} سجل لوجود رقم قيد مكرر.`;
                alert(msg);

                input.value = '';
                router.navigate('list');
            } catch (err) {
                alert('فشل قراءة الملف.');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    router.init();

    // Add Form Handle
    document.getElementById('addForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const success = store.add({
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            regNumber: formData.get('regNumber'),
            pageNumber: formData.get('pageNumber')
        });

        if (success) {
            e.target.reset();
            router.navigate('list');
        }
    });

    // Edit Form Handle
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const id = document.getElementById('edit_id').value;

            const success = store.update(id, {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                regNumber: formData.get('regNumber'),
                pageNumber: formData.get('pageNumber')
            });

            if (success) {
                router.navigate('detail', id);
            }
        });
    }

    // Search Handle
    const searchInput = document.getElementById('searchInput');
    const filterReg = document.getElementById('filterReg');

    if (searchInput) searchInput.addEventListener('input', () => renderList());
    if (filterReg) filterReg.addEventListener('change', () => renderList());
});
