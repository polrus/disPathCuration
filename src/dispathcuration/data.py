"""Download and cache Open Targets Platform datasets."""

from __future__ import annotations

import re
import sys

import polars as pl
import requests

from .config import DATA_DIR, DATASETS, FTP_BASE


def _list_parts(name: str) -> list[str]:
    """List the parquet file names in a dataset directory on the FTP."""
    listing = requests.get(f"{FTP_BASE}/{name}/", timeout=60)
    listing.raise_for_status()
    files = re.findall(r'href="([^"]+\.parquet)"', listing.text)
    if not files:
        raise RuntimeError(f"no parquet file found in {FTP_BASE}/{name}/")
    return files


def _download(url: str, local: Path) -> None:
    print(f"downloading {url}", file=sys.stderr)
    with requests.get(url, stream=True, timeout=600) as response:
        response.raise_for_status()
        tmp = local.with_suffix(local.suffix + ".part")
        with tmp.open("wb") as handle:
            for block in response.iter_content(chunk_size=1 << 20):
                handle.write(block)
        tmp.replace(local)


def fetch(name: str, force: bool = False, columns: list[str] | None = None) -> pl.DataFrame:
    """Load a dataset, downloading it to the local cache on first use.

    A dataset may be a single file, a single directory-resolved part, or many
    parts. Multi-part datasets (`DATASETS[name]` is a list) are concatenated
    after loading; `columns` projects them before concatenation, which keeps a
    wide dataset such as `target` small in memory.
    """
    if name not in DATASETS:
        raise KeyError(f"unknown dataset {name!r}; expected one of {sorted(DATASETS)}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    spec = DATASETS[name]

    if isinstance(spec, list):
        parts = _list_parts(name)
        frames = []
        for index, part in enumerate(parts):
            local = DATA_DIR / f"{name}.part{index}.parquet"
            if force or not local.exists():
                _download(f"{FTP_BASE}/{name}/{part}", local)
            frame = pl.read_parquet(local)
            frames.append(frame.select(columns) if columns else frame)
        return pl.concat(frames)

    local = DATA_DIR / f"{name}.parquet"
    if force or not local.exists():
        url = f"{FTP_BASE}/{spec}" if spec else f"{FTP_BASE}/{name}/{_list_parts(name)[0]}"
        _download(url, local)
    frame = pl.read_parquet(local)
    return frame.select(columns) if columns else frame
