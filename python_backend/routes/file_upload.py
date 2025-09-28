import os
import tempfile
import shutil
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database import get_db
from services.file_processor import DealFileProcessor
from services.deals_service import DealsService
from models import Deal
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Maximum file size (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    'csv', 'xls', 'xlsx', 'xml', 'json', 'txt'
}

def allowed_file(filename: str) -> bool:
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@router.post("/upload-deals")
async def upload_deal_file(
    file: UploadFile = File(...),
    network: str = Form(...),
    notes: str = Form(""),
    db: AsyncSession = Depends(get_db)
):
    """Upload and process deal files from affiliate networks"""
    
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file selected")
        
        if not allowed_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Check file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as temp_file:
            temp_file.write(contents)
            temp_file_path = temp_file.name
        
        try:
            # Process the file
            processor = DealFileProcessor()
            result = await processor.process_file(temp_file_path, network, notes)
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=f"File processing failed: {result['error']}")
            
            # Save valid deals to database
            deals_service = DealsService()
            saved_deals = []
            
            for deal_data in result['deals']:
                if deal_data.get('valid', False):
                    try:
                        # Create deal object with mapped fields
                        deal_dict = {
                            'title': deal_data.get('title', ''),
                            'description': deal_data.get('description', ''),
                            'price': deal_data.get('price'),
                            'original_price': deal_data.get('original_price'),
                            'discount_percent': deal_data.get('discount_percent'),
                            'image_url': deal_data.get('image_url', ''),
                            'product_url': deal_data.get('product_url', ''),
                            'affiliate_url': deal_data.get('product_url', ''),
                            'category': deal_data.get('category', 'General'),
                            'brand': deal_data.get('brand', ''),
                            'rating': deal_data.get('rating'),
                            'availability': deal_data.get('availability', 'In Stock'),
                            'deal_type': 'file_upload',
                            'deal_source': f"{network}_file",
                            'network_name': network.title(),
                            'status': 'pending',  # All uploaded deals start as pending
                            'notes': f"Uploaded file: {file.filename}. {notes}".strip()
                        }
                        
                        # Remove None values
                        deal_dict = {k: v for k, v in deal_dict.items() if v is not None}
                        
                        # Save to database using direct database insertion
                        deal = Deal(**deal_dict)
                        db.add(deal)
                        await db.flush()  # Flush to get the ID
                        saved_deals.append(deal)
                        
                    except Exception as e:
                        logger.error(f"Error saving deal: {e}")
                        continue
            
            # Create upload log entry
            upload_log = {
                'filename': file.filename,
                'network': network,
                'total_records': len(result['deals']),
                'valid_records': len([d for d in result['deals'] if d.get('valid')]),
                'saved_deals': len(saved_deals),
                'upload_time': datetime.utcnow(),
                'notes': notes,
                'uploaded_by': 'admin'
            }
            
            # Store upload log in database
            await db.execute(
                text("""
                    INSERT INTO upload_logs 
                    (filename, network, total_records, valid_records, saved_deals, upload_time, notes, uploaded_by)
                    VALUES (:filename, :network, :total_records, :valid_records, :saved_deals, :upload_time, :notes, :uploaded_by)
                """),
                upload_log
            )
            await db.commit()
            
            return {
                'success': True,
                'message': f'Successfully processed {file.filename}',
                'deals_processed': len(result['deals']),
                'deals_valid': len([d for d in result['deals'] if d.get('valid')]),
                'deals_saved': len(saved_deals),
                'file_info': result['file_info'],
                'upload_summary': upload_log
            }
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except OSError:
                pass
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/upload-logs")
async def get_upload_logs(
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get upload history logs"""
    
    try:
        # Create upload_logs table if it doesn't exist
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS upload_logs (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                network VARCHAR(50) NOT NULL,
                total_records INTEGER DEFAULT 0,
                valid_records INTEGER DEFAULT 0,
                saved_deals INTEGER DEFAULT 0,
                upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                uploaded_by VARCHAR(100) DEFAULT 'admin'
            )
        """))
        await db.commit()
        
        # Get upload logs
        result = await db.execute(
            text("""
                SELECT * FROM upload_logs 
                ORDER BY upload_time DESC 
                LIMIT :limit OFFSET :offset
            """),
            {"limit": limit, "offset": offset}
        )
        
        logs = []
        for row in result.fetchall():
            logs.append({
                'id': row.id,
                'filename': row.filename,
                'network': row.network,
                'total_records': row.total_records,
                'valid_records': row.valid_records,
                'saved_deals': row.saved_deals,
                'upload_time': row.upload_time.isoformat() if row.upload_time else None,
                'notes': row.notes,
                'uploaded_by': row.uploaded_by
            })
        
        return {
            'logs': logs,
            'total': len(logs)
        }
        
    except Exception as e:
        logger.error(f"Error fetching upload logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch upload logs")

@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported file formats and network mappings"""
    
    processor = DealFileProcessor()
    
    return {
        'supported_formats': list(ALLOWED_EXTENSIONS),
        'max_file_size_mb': MAX_FILE_SIZE // (1024 * 1024),
        'networks': list(processor.network_mappings.keys()),
        'field_mappings': processor.network_mappings,
        'description': "Upload deal files from affiliate networks that don't provide API access"
    }