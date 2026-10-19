/**
 * Main Interactive Script
 * Startup Tindahan Helper Marketing Page
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // --- Mobile Menu Toggle ---
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }

  // --- Research-Backed Scroll Progress & Directional Affordance ---
  const scrollProgressBar = document.getElementById('scroll-progress-bar');
  const heroScrollCue = document.getElementById('hero-scroll-cue');

  function updateScrollState() {
    const scrollTop = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    // 1. Goal-Gradient Progress Bar
    if (scrollProgressBar && docHeight > 0) {
      const scrollPercent = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
      scrollProgressBar.style.width = scrollPercent + '%';
    }

    // 2. Micro-Affordance Fade-out (disappears immediately as soon as user starts scrolling)
    if (heroScrollCue) {
      if (scrollTop > 15) {
        heroScrollCue.style.opacity = '0';
        heroScrollCue.style.pointerEvents = 'none';
        heroScrollCue.style.transform = 'translateY(12px) scale(0.96)';
        heroScrollCue.style.visibility = 'hidden';
      } else {
        heroScrollCue.style.visibility = 'visible';
        heroScrollCue.style.opacity = '1';
        heroScrollCue.style.pointerEvents = 'auto';
        heroScrollCue.style.transform = 'translateY(0) scale(1)';
      }
    }
  }

  window.addEventListener('scroll', updateScrollState, { passive: true });
  document.addEventListener('scroll', updateScrollState, { passive: true });
  updateScrollState();

  // --- Check Download Status (Controlled by gg.php) ---
  let downloadConfig = {
    downloads_enabled: true,
    disabled_message: "Pansamantalang sarado ang public APK download para sa update. Mangyaring tumawag o mag-text sa 0991 658 9854 para sa direct VIP installation.",
    contact_number: "0991 658 9854"
  };

  async function checkDownloadStatus() {
    try {
      const res = await fetch('./api/status.php');
      if (res.ok) {
        const data = await res.json();
        downloadConfig = Object.assign(downloadConfig, data);
      }
    } catch (e) {
      // Fallback to direct json file
      try {
        const resJson = await fetch('./download_status.json');
        if (resJson.ok) {
          const dataJson = await resJson.json();
          downloadConfig = Object.assign(downloadConfig, dataJson);
        }
      } catch (err) {}
    }
  }

  checkDownloadStatus();

  // --- Video Player Controls (Single Merged Video) ---
  const videoPlayer = document.getElementById('promo-video');
  const videoPlayBtn = document.getElementById('video-play-btn');
  const videoMuteBtn = document.getElementById('video-mute-btn');

  function updateMuteButtonState() {
    if (!videoMuteBtn || !videoPlayer) return;
    if (videoPlayer.muted) {
      videoMuteBtn.innerHTML = '<i data-lucide="volume-x" class="w-4 h-4"></i> <span>I-on ang Tunog (Muted)</span>';
      videoMuteBtn.classList.remove('bg-emerald-600/90', 'border-emerald-400/50');
      videoMuteBtn.classList.add('bg-black/75', 'border-white/20');
    } else {
      videoMuteBtn.innerHTML = '<i data-lucide="volume-2" class="w-4 h-4 text-emerald-300"></i> <span class="text-emerald-300 font-semibold">May Tunog (Sound On)</span>';
      videoMuteBtn.classList.add('bg-emerald-600/90', 'border-emerald-400/50');
      videoMuteBtn.classList.remove('bg-black/75', 'border-white/20');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  if (videoPlayer) {
    function handlePlayWithSound() {
      videoPlayer.muted = false; // Unmute sound on user interaction
      updateMuteButtonState();

      if (videoPlayer.paused) {
        videoPlayer.play().catch((err) => {
          console.warn('Playback error:', err);
        });
        if (videoPlayBtn) videoPlayBtn.classList.add('opacity-0', 'pointer-events-none');
      } else {
        videoPlayer.pause();
        if (videoPlayBtn) videoPlayBtn.classList.remove('opacity-0', 'pointer-events-none');
      }
    }

    if (videoPlayBtn) {
      videoPlayBtn.addEventListener('click', handlePlayWithSound);
    }

    videoPlayer.addEventListener('click', handlePlayWithSound);

    videoPlayer.addEventListener('play', () => {
      if (videoPlayBtn) videoPlayBtn.classList.add('opacity-0', 'pointer-events-none');
    });

    videoPlayer.addEventListener('pause', () => {
      if (videoPlayBtn) videoPlayBtn.classList.remove('opacity-0', 'pointer-events-none');
    });

    // Mute/Unmute Toggle
    if (videoMuteBtn) {
      videoMuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoPlayer.muted = !videoPlayer.muted;
        updateMuteButtonState();
      });
    }

    // --- Auto Play with Sound on Scroll (Intersection Observer) ---
    let userHasInteracted = false;
    const unlockAudio = () => {
      userHasInteracted = true;
      ['click', 'touchstart', 'scroll', 'wheel'].forEach(evt => {
        window.removeEventListener(evt, unlockAudio);
      });
    };
    ['click', 'touchstart', 'scroll', 'wheel'].forEach(evt => {
      window.addEventListener(evt, unlockAudio, { passive: true, once: true });
    });

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Scrolled into view: auto play with sound!
          videoPlayer.muted = false;
          updateMuteButtonState();

          const playPromise = videoPlayer.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              // Successfully playing with sound!
              if (videoPlayBtn) videoPlayBtn.classList.add('opacity-0', 'pointer-events-none');
              updateMuteButtonState();
            }).catch((err) => {
              console.warn('Browser required gesture for sound, falling back to muted auto-play:', err);
              // Fallback to muted if browser blocks unmuted audio on this domain
              videoPlayer.muted = true;
              updateMuteButtonState();
              videoPlayer.play().catch(() => {});
            });
          }
        } else {
          // Scrolled out of view: pause to avoid background noise & save battery
          if (!videoPlayer.paused) {
            videoPlayer.pause();
            if (videoPlayBtn) videoPlayBtn.classList.remove('opacity-0', 'pointer-events-none');
          }
        }
      });
    }, {
      threshold: 0.3 // Trigger when 30% of the video section is visible
    });

    const videoSection = document.getElementById('video-demo') || videoPlayer;
    videoObserver.observe(videoSection);
  }


  // --- Privacy Policy Modal ---
  const privacyModal = document.getElementById('privacy-modal');
  const openPrivacyBtns = document.querySelectorAll('.open-privacy-modal-btn');
  const closePrivacyBtn = document.getElementById('close-privacy-btn');

  function openPrivacy() {
    if (!privacyModal) return;
    privacyModal.classList.remove('hidden');
    privacyModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closePrivacy() {
    if (!privacyModal) return;
    privacyModal.classList.add('hidden');
    privacyModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  openPrivacyBtns.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    openPrivacy();
  }));

  if (closePrivacyBtn) closePrivacyBtn.addEventListener('click', closePrivacy);
  if (privacyModal) {
    privacyModal.addEventListener('click', (e) => {
      if (e.target === privacyModal) closePrivacy();
    });
  }

  // --- Sign-Up Modal & Download Gatekeeper ---
  const signupModal = document.getElementById('signup-modal');
  const openModalBtns = document.querySelectorAll('.open-signup-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const signupForm = document.getElementById('signup-form');
  const signupSuccessMessage = document.getElementById('signup-success');
  const submitBtn = document.getElementById('submit-signup-btn');
  const modalNotice = document.getElementById('modal-gate-notice');

  function openModal(isDownloadGated = false) {
    if (!signupModal) return;
    if (modalNotice) {
      if (downloadConfig.downloads_enabled === false) {
        modalNotice.innerHTML = '<i data-lucide="info" class="w-4 h-4 text-amber-400 shrink-0"></i> <span><strong>Priority Waitlist:</strong> Pansamantalang sarado ang public download link. Mag-sign up sa ibaba upang mai-save ang iyong slot sa susunod na batch o tawagan si <strong>0991 658 9854</strong>.</span>';
        modalNotice.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      } else if (isDownloadGated) {
        modalNotice.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 text-amber-400 shrink-0"></i> <span><strong>Mag-sign up muna</strong> para agad na mag-download ang APK!</span>';
        modalNotice.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
      } else {
        modalNotice.classList.add('hidden');
      }
    }
    signupModal.classList.remove('hidden');
    signupModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }


  function closeModal() {
    if (!signupModal) return;
    signupModal.classList.add('hidden');
    signupModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  openModalBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(false);
    });
  });

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (signupModal) {
    signupModal.addEventListener('click', (e) => {
      if (e.target === signupModal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (signupModal && !signupModal.classList.contains('hidden')) closeModal();
      if (privacyModal && !privacyModal.classList.contains('hidden')) closePrivacy();
    }
  });

  function hasUserSignedUp() {
    return localStorage.getItem('tindahan_registered_user') !== null;
  }

  // --- Disabled Advisory Modal ---
  const disabledModal = document.getElementById('disabled-download-modal');
  const closeDisabledBtn = document.getElementById('close-disabled-btn');

  function showDisabledDownloadModal() {
    if (disabledModal) {
      const msgElem = document.getElementById('disabled-modal-message');
      if (msgElem && downloadConfig.disabled_message) {
        msgElem.textContent = downloadConfig.disabled_message;
      }
      disabledModal.classList.remove('hidden');
      disabledModal.classList.add('flex');
    } else {
      alert(downloadConfig.disabled_message || "Pansamantalang sarado ang APK download. Kontakin si 0991 658 9854.");
    }
  }

  if (closeDisabledBtn && disabledModal) {
    closeDisabledBtn.addEventListener('click', () => {
      disabledModal.classList.add('hidden');
      disabledModal.classList.remove('flex');
    });
  }

  // --- APK Download Trigger ---
  const installGuideModal = document.getElementById('install-guide-modal');
  const closeGuideBtn = document.getElementById('close-guide-btn');

  function triggerApkDownload(explicitUrl = null) {
    // Check if disabled by admin via gg.php
    if (downloadConfig.downloads_enabled === false) {
      showDisabledDownloadModal();
      return;
    }

    const apkUrl = explicitUrl || downloadConfig.apk_download_url || './apk/tindahan-helper.apk';

    const link = document.createElement('a');
    link.href = apkUrl;
    link.download = 'Startup-Tindahan-Helper.apk';
    if (apkUrl.startsWith('http://') || apkUrl.startsWith('https://')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 200);

    // Show install guide modal
    if (installGuideModal) {
      installGuideModal.classList.remove('hidden');
      installGuideModal.classList.add('flex');
    }
  }

  // Intercept all download buttons: Must sign up first!
  const downloadBtns = document.querySelectorAll('.trigger-download-apk');
  downloadBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await checkDownloadStatus();

      // If user has NOT signed up yet, ALWAYS let them register and save details first!
      if (!hasUserSignedUp()) {
        openModal(true);
      } else {
        // If already signed up:
        if (downloadConfig.downloads_enabled === false) {
          showDisabledDownloadModal();
        } else {
          triggerApkDownload();
        }
      }
    });
  });


  // Handle Form Submission & Save to .txt File
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('user-name')?.value.trim();
      const phone = document.getElementById('user-phone')?.value.trim();
      const store = document.getElementById('user-store')?.value.trim() || 'N/A';
      const location = document.getElementById('user-location')?.value.trim() || 'N/A';

      if (!name || !phone) {
        alert('Mangyaring punan ang iyong pangalan at cellphone number.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Sine-save sa signups.txt...';
      }

      const isEnabled = downloadConfig.downloads_enabled !== false;
      const leadData = {
        name,
        phone,
        store,
        location,
        download_status: isEnabled ? 'SUCCESS (APK Downloaded)' : 'UNSUCCESSFUL (Download Disabled / Priority Waitlist)',
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
      };

      // 1. Send to PHP backend to write directly into signups.txt
      let serverResponse = null;
      try {
        const res = await fetch('./api/signup.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        });
        serverResponse = await res.json();
      } catch (err) {
        console.warn('Backend write attempted (PHP):', err);
      }

      if (serverResponse && serverResponse.download_status) {
        leadData.download_status = serverResponse.download_status;
      }

      // 2. Mark user as registered in localStorage
      try {
        localStorage.setItem('tindahan_registered_user', JSON.stringify(leadData));
        const existingLeads = JSON.parse(localStorage.getItem('tindahan_leads') || '[]');
        existingLeads.push(leadData);
        localStorage.setItem('tindahan_leads', JSON.stringify(existingLeads));
      } catch (err) {
        console.error('Storage error:', err);
      }

      // 3. Update UI to success state
      signupForm.classList.add('hidden');
      if (signupSuccessMessage) {
        signupSuccessMessage.classList.remove('hidden');
      }

      // 4. Trigger download or disabled notice
      setTimeout(async () => {
        closeModal();
        await checkDownloadStatus();
        if (downloadConfig.downloads_enabled === false) {
          showDisabledDownloadModal();
        } else {
          const dlUrl = (serverResponse && serverResponse.download_url) ? serverResponse.download_url : null;
          triggerApkDownload(dlUrl);
        }
      }, 1500);
    });
  }

  if (closeGuideBtn && installGuideModal) {
    closeGuideBtn.addEventListener('click', () => {
      installGuideModal.classList.add('hidden');
      installGuideModal.classList.remove('flex');
    });
  }

  if (installGuideModal) {
    installGuideModal.addEventListener('click', (e) => {
      if (e.target === installGuideModal) {
        installGuideModal.classList.add('hidden');
        installGuideModal.classList.remove('flex');
      }
    });
  }
});
