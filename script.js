const editor = document.getElementById('code');
const lineNumbers = document.querySelector('.line-numbers');

function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: lines }, (_, index) => `<div>${index + 1}</div>`).join('');
}

function syncScroll() {
    lineNumbers.scrollTop = editor.scrollTop;
}

editor.addEventListener('input', () => {
    updateLineNumbers();
    syncScroll();
});

editor.addEventListener('scroll', syncScroll);

// Initial update
updateLineNumbers();
syncScroll();

