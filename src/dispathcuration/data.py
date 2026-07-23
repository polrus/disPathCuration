"""Download and cache Open Targets Platform datasets."""

from __future__ import annotations

import re
import sys

import polars as pl
import requests

from .config import DATA_DIR, DATASETS, FTP_BASE


def _resolve_url(name: str) -> str:
    """Return the download URL for a dataset, listing the directory if needed."""
    path = DATASETS[name]
    if path is not None:
        return f"{FTP_BASE}/{path}"

    listing = requests.get(f"{FTP_BASE}/{name}/", timeout=60)
    listing.raise_for_status()
    files = re.findall(r'href="([^"]+\.parquet)"', listing.text)
    if not files:
        raise RuntimeError(f"no parquet file found in {FTP_BASE}/{name}/")
    if len(files) > 1:
        raise RuntimeError(
            f"{name} is split across {len(files)} parts; this loader assumes one"
        )
    return f"{FTP_BASE}/{name}/{files[0]}"


def fetch(name: str, force: bool = False) -> pl.DataFrame:
    """Load a dataset, downloading it to the local cache on first use."""
    if name not in DATASETS:
        raise KeyError(f"unknown dataset {name!r}; expected one of {sorted(DATASETS)}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    local = DATA_DIR / f"{name}.parquet"

    if force or not local.exists():
        url = _resolve_url(name)
        print(f"downloading {name} from {url}", file=sys.stderr)
        with requests.get(url, stream=True, timeout=600) as response:
            response.raise_for_status()
            tmp = local.with_suffix(".parquet.part")
            with tmp.open("wb") as handle:
                for block in response.iter_content(chunk_size=1 << 20):
                    handle.write(block)
            tmp.replace(local)

    return pl.read_parquet(local)
