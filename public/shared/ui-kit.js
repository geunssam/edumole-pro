/**
 * EduMole Pro - UI Kit (공통 UI 헬퍼)
 * 토스트, 로딩 오버레이 등 모든 게임에서 공유하는 UI 유틸
 */
(function () {
    'use strict';

    var toastTimeout = null;

    /**
     * 토스트 메시지 표시
     * @param {string} message - 표시할 메시지
     * @param {Object} [options] - { duration: ms, type: 'info'|'success'|'error' }
     */
    function showToast(message, options) {
        var opts = options || {};
        var duration = opts.duration || 3000;
        var type = opts.type || 'info';

        // 기존 토스트 제거
        var existing = document.getElementById('edumole-toast');
        if (existing) existing.remove();
        if (toastTimeout) clearTimeout(toastTimeout);

        var toast = document.createElement('div');
        toast.id = 'edumole-toast';
        toast.className = 'edumole-toast edumole-toast--' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 표시 애니메이션
        requestAnimationFrame(function () {
            toast.classList.add('edumole-toast--visible');
        });

        // 자동 제거
        toastTimeout = setTimeout(function () {
            toast.classList.remove('edumole-toast--visible');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    /**
     * 로딩 오버레이 표시
     * @param {string} [message] - 로딩 메시지 (기본: '로딩 중...')
     */
    function showLoading(message) {
        hideLoading(); // 기존 로딩 제거

        var overlay = document.createElement('div');
        overlay.id = 'edumole-loading';
        overlay.className = 'edumole-loading-overlay';
        overlay.innerHTML =
            '<div class="edumole-loading-content">' +
            '<div class="edumole-spinner"></div>' +
            '<p>' + (message || '로딩 중...') + '</p>' +
            '</div>';
        document.body.appendChild(overlay);
    }

    /**
     * 로딩 오버레이 숨기기
     */
    function hideLoading() {
        var existing = document.getElementById('edumole-loading');
        if (existing) existing.remove();
    }

    // 전역 객체로 노출
    window.UIKit = {
        showToast: showToast,
        showLoading: showLoading,
        hideLoading: hideLoading
    };
})();
