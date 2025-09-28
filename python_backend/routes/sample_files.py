import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter()

SAMPLE_FILES_DIR = Path(__file__).parent.parent / "sample_files"

# Sample file information
SAMPLE_FILES = {
    'amazon': {
        'filename': 'amazon_deals_sample.csv',
        'description': 'Amazon Associates deal format with product details',
        'fields': ['title', 'description', 'price', 'original_price', 'image_url', 'product_url', 'category', 'brand', 'rating', 'availability']
    },
    'cj': {
        'filename': 'cj_deals_sample.csv', 
        'description': 'Commission Junction export format',
        'fields': ['name', 'description', 'sale_price', 'original_price', 'image_url', 'click_url', 'category', 'advertiser_name', 'commission_amount']
    },
    'shareasale': {
        'filename': 'shareasale_deals_sample.csv',
        'description': 'ShareASale merchant export format',
        'fields': ['merchantname', 'product', 'description', 'price', 'saleprice', 'thumb', 'directurl', 'category', 'commission']
    }
}

@router.get("/download/{network}")
async def download_sample_file(network: str):
    """Download sample file for a specific affiliate network"""
    
    if network not in SAMPLE_FILES:
        raise HTTPException(status_code=404, detail=f"Sample file not found for network: {network}")
    
    file_info = SAMPLE_FILES[network]
    file_path = SAMPLE_FILES_DIR / file_info['filename']
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sample file not found on disk")
    
    return FileResponse(
        path=str(file_path),
        filename=file_info['filename'],
        media_type='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="{file_info["filename"]}"'
        }
    )

@router.get("/formats")
async def get_sample_formats():
    """Get information about all available sample file formats"""
    
    formats = {}
    for network, info in SAMPLE_FILES.items():
        file_path = SAMPLE_FILES_DIR / info['filename']
        formats[network] = {
            'description': info['description'],
            'fields': info['fields'],
            'filename': info['filename'],
            'available': file_path.exists(),
            'download_url': f'/api/admin/deals/samples/download/{network}'
        }
    
    return {
        'formats': formats,
        'instructions': {
            'csv': 'Use comma-separated values with headers in the first row',
            'excel': 'Create Excel file with data in the first sheet, headers in row 1',
            'json': 'Use array of objects format: [{"field1": "value1", "field2": "value2"}]',
            'xml': 'Use <product> or <deal> elements with field names as child elements'
        },
        'tips': [
            'Ensure all required fields (title, price) are included',
            'Use proper URLs for images and affiliate links', 
            'Price fields should be numeric (e.g., 29.99 not $29.99)',
            'Category names should be clear and descriptive',
            'Include descriptions for better AI validation scores'
        ]
    }