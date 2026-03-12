"""
Quick test to verify paper fetching works.
Run: python test_papers.py
"""

import asyncio
import logging

# Enable detailed logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

from agents.paper_finder import PaperFinder


async def test():
    finder = PaperFinder()

    print("\n" + "=" * 60)
    print("TEST 1: Simple topic search")
    print("=" * 60)

    papers = await finder.find_papers("machine learning", max_results=5)

    print(f"\nFound {len(papers)} papers:")
    for i, p in enumerate(papers, 1):
        print(f"\n  [{i}] {p.title}")
        print(f"      Source: {p.source}")
        print(f"      Year: {p.year}")
        print(f"      Authors: {', '.join(p.authors[:3])}")
        print(f"      Abstract: {p.abstract[:100]}...")
        print(f"      PDF URL: {p.pdf_url or 'None'}")
        print(f"      Full text: {len(p.full_text)} chars")

    if not papers:
        print("\n⚠️  NO PAPERS FOUND — there may be a network issue")
        print("    Trying raw HTTP requests to diagnose...\n")
        await diagnose()

    print("\n" + "=" * 60)
    print("TEST 2: CRISPR topic")
    print("=" * 60)

    papers2 = await finder.find_papers("CRISPR gene editing", max_results=5)
    print(f"Found {len(papers2)} papers")
    for i, p in enumerate(papers2, 1):
        print(f"  [{i}] {p.title[:70]}... ({p.source})")


async def diagnose():
    """Raw HTTP requests to check if APIs are reachable."""
    import httpx

    print("--- Checking Semantic Scholar ---")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={"query": "test", "limit": 1, "fields": "title"},
            )
            print(f"  Status: {resp.status_code}")
            print(f"  Body: {resp.text[:300]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n--- Checking arXiv ---")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "http://export.arxiv.org/api/query",
                params={"search_query": "all:machine learning", "max_results": 1},
            )
            print(f"  Status: {resp.status_code}")
            print(f"  Body length: {len(resp.text)} chars")
            print(f"  First 300 chars: {resp.text[:300]}")
    except Exception as e:
        print(f"  ERROR: {e}")


if __name__ == "__main__":
    asyncio.run(test())