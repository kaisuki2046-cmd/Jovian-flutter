(() => {
  const channel = window.JovianCompute;
  let worker;
  let address;
  let input = [];

  function closeWorker() {
    worker?.terminate();
    if (address) URL.revokeObjectURL(address);
    worker = undefined;
    address = undefined;
    input = [];
  }

  function send(message) {
    // The mobile views also carry unknown-time snapshots with many chart candidates.
    const size = 48 * 1024;
    for (let offset = 0; offset < message.length;) {
      let end = Math.min(offset + size, message.length);
      const last = message.charCodeAt(end - 1);
      if (end < message.length && last >= 0xd800 && last <= 0xdbff) end--;
      channel.postMessage((end < message.length ? '0' : '1') + message.slice(offset, end));
      offset = end;
    }
  }

  function fail() {
    send(JSON.stringify({ error: '本机计算脚本加载失败，请重试。' }));
    closeWorker();
  }

  const decode = (base64) => Uint8Array.from(atob(base64), (byte) => byte.charCodeAt(0));
  window.jovianNativeCompute = {
    append(value) { input.push(value); },
    run() {
      try {
        const program = decode(document.getElementById('jovian-compute-program').textContent.trim());
        const message = new TextDecoder().decode(decode(input.join('')));
        input = [];
        address = URL.createObjectURL(new Blob([program], { type: 'text/javascript' }));
        worker = new Worker(address);
        worker.onmessage = ({ data }) => {
          if (typeof data !== 'string') {
            fail();
            return;
          }
          send(data);
          if (!data.startsWith('{"stage":')) closeWorker();
        };
        worker.onerror = (event) => { event.preventDefault(); fail(); };
        worker.onmessageerror = fail;
        worker.postMessage(message);
      } catch {
        fail();
      }
    },
    close: closeWorker,
  };
  channel.postMessage('ready');
})();
