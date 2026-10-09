(function () {
  var recoveryKey = 'deployment-recovery-last-reload';
  var recoveryWindowMs = 30000;
  var reloadScheduled = false;
  var deploymentErrorPattern = /deployment could not be found|deployment not found|failed to fetch dynamically imported module|loading (?:css )?chunk[^]*failed|chunkloaderror|importing a module script failed|mime type.*text\/html/i;

  function errorMessage(error) {
    if (typeof error === 'string') return error;
    if (error && typeof error.message === 'string') return error.message;
    if (error && typeof error.reason === 'string') return error.reason;
    if (error && error.reason && typeof error.reason.message === 'string') return error.reason.message;
    return '';
  }

  function isDeploymentLoadError(error) {
    return deploymentErrorPattern.test(errorMessage(error));
  }

  function recoverFromDeploymentError(error) {
    if (!isDeploymentLoadError(error)) return false;
    if (reloadScheduled) return true;

    try {
      var lastReload = Number(sessionStorage.getItem(recoveryKey));
      if (lastReload && Date.now() - lastReload < recoveryWindowMs) return false;
      sessionStorage.setItem(recoveryKey, String(Date.now()));
    } catch (storageError) {
      console.error('Unable to safely recover from a stale deployment because session storage is unavailable.', storageError);
      return false;
    }

    reloadScheduled = true;
    window.location.reload();
    return true;
  }

  window.isDeploymentLoadError = isDeploymentLoadError;
  window.recoverFromDeploymentError = recoverFromDeploymentError;

  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target instanceof HTMLScriptElement) {
      try {
        var failedUrl = new URL(target.src, window.location.href);
        if (failedUrl.origin === window.location.origin && /^\/assets\/.*\.js$/i.test(failedUrl.pathname)) {
          recoverFromDeploymentError('Loading chunk failed: fingerprinted JavaScript asset.');
          return;
        }
      } catch (error) {
        console.error('Unable to inspect a failed script URL.', error);
      }
    }
    recoverFromDeploymentError(event.message);
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    recoverFromDeploymentError(event.reason);
  });
})();
