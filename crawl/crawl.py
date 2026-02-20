import time
import threading
import queue
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, List

import requests
import lmdb


USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
_thread_local = threading.local()


class RateLimiter:
    def __init__(self, qps: float):
        self.interval = 0.0 if not qps or qps <= 0 else 1.0 / qps
        self.lock = threading.Lock()
        self.next_time = time.monotonic()

    def wait(self) -> None:
        if self.interval <= 0:
            return
        with self.lock:
            now = time.monotonic()
            if now < self.next_time:
                sleep_for = self.next_time - now
                self.next_time += self.interval
            else:
                sleep_for = 0.0
                self.next_time = now + self.interval
        if sleep_for > 0:
            time.sleep(sleep_for)




def _get_session() -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})
        _thread_local.session = session
    return session




def collect_captchas_to_lmdb(
    db_path: str,
    num_samples: int,
    num_workers: int = 6,
    qps: float = 3.0,
    timeout: float = 5,
    max_retries: int = 3,
    verify_ssl: bool = False,
):
    """
    通过 HTTP 请求获取验证码图像并存储于 LMDB 环境。

    参数:
        db_path (str): LMDB 数据库的存储路径。
        num_samples (int): 计划采集的样本总数。
        num_workers (int): 并发线程数，默认 6。
        qps (float): 全局 QPS 限速，默认 3.0。
        timeout (float): 单次请求超时（秒），默认 5。
        max_retries (int): 请求失败重试次数，默认 3。
        verify_ssl (bool): 是否校验证书，默认 False（保持原行为）。
    """
    if not verify_ssl:
        warnings.filterwarnings("ignore", message="Unverified HTTPS request", category=requests.packages.urllib3.exceptions.InsecureRequestWarning)

    map_size = 1024 * 1024 * 1024 # 1GB
    # 初始化目标 URL（请替换为合规的测试端点）
    base_url = "https://authserver.nju.edu.cn/authserver/getCaptcha.htl?{}"
    # 全局限速器
    rate_limiter = RateLimiter(qps=qps)

    result_queue: queue.Queue = queue.Queue(maxsize=max(2, num_workers * 4))
    write_stats = {"stored": 0}
    start_time = time.time()
    progress_lock = threading.Lock()

    def _print_progress() -> None:
        with counters_lock:
            done = success_count + failure_count
        total = num_samples
        elapsed = max(0.001, time.time() - start_time)
        speed = done / elapsed
        percent = (done / total * 100) if total else 0.0
        bar_len = 30
        filled = int(bar_len * (done / total)) if total else 0
        bar = "#" * filled + "-" * (bar_len - filled)
        print(f"\r进度 [{bar}] {done}/{total} ({percent:.1f}%) 速率 {speed:.2f}/s", end="", flush=True)

    def writer() -> None:
        env = lmdb.open(db_path, map_size=map_size)
        pending = []
        batch_size = 100
        while True:
            item = result_queue.get()
            if item is None:
                if pending:
                    with env.begin(write=True) as txn:
                        for key, value in pending:
                            txn.put(key, value)
                            write_stats["stored"] += 1
                            # print(f"已存储: Key={key.decode('ascii')}, Size={len(value)} bytes")
                    pending.clear()
                break
            pending.append(item)
            if len(pending) >= batch_size:
                with env.begin(write=True) as txn:
                    for key, value in pending:
                        txn.put(key, value)
                        write_stats["stored"] += 1
                        _print_progress()
                        # print(f"已存储: Key={key.decode('ascii')}, Size={len(value)} bytes")
                pending.clear()
        env.close()

    writer_thread = threading.Thread(target=writer)
    writer_thread.start()

    counters_lock = threading.Lock()
    success_count = 0
    failure_count = 0

    def worker(i: int) -> None:
        nonlocal success_count, failure_count
        for attempt in range(1, max_retries + 1):
            rate_limiter.wait()
            timestamp = int(time.time() * 1000)
            url = base_url.format(timestamp)
            session = _get_session()
            try:
                response = session.get(url, timeout=timeout, verify=verify_ssl)
                response.raise_for_status()
                image_bytes = response.content
                if len(image_bytes) < 100:
                    raise ValueError("响应数据过小")
                key = f"{i:08d}".encode("ascii")
                result_queue.put((key, image_bytes))
                with counters_lock:
                    success_count += 1
                return
            except Exception as e:
                if attempt >= max_retries:
                    with counters_lock:
                        failure_count += 1
                    print(f"请求失败 (样本 {i}, 已重试 {attempt}/{max_retries}): {e}")
                else:
                    print(f"请求失败 (样本 {i}, 重试 {attempt}/{max_retries}): {e}")
                    time.sleep(2)

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(worker, i) for i in range(1, num_samples + 1)]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                print(f"线程异常: {e}")

    result_queue.put(None)
    writer_thread.join()

    print(f"采集完成。成功: {success_count}, 失败: {failure_count}, 写入: {write_stats['stored']}")


if __name__ == "__main__":
    # 设定 LMDB 保存目录（目录需提前存在或由 lmdb 自动创建）
    dataset_dir = "./val_lmdb"
    # 执行采集函数
    collect_captchas_to_lmdb(
        db_path=dataset_dir,
        num_samples=10000,
        num_workers=4,
        qps=24.0,
    )
