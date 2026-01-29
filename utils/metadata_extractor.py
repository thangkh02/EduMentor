import os
import re
from typing import Dict, Any, Optional
from datetime import datetime

class MetadataExtractor:
    @staticmethod
    def extract_metadata(content: str, file_path: Optional[str] = None, file_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract rich metadata from document content and file information.
        
        Args:
            content: The text content of the document
            file_path: Path to the source file
            file_type: Type of the file (pdf, md, txt, etc.)
            
        Returns:
            Dictionary containing extracted metadata
        """
        metadata = {
            "source": os.path.basename(file_path) if file_path else "Unknown",
            "extraction_date": datetime.now().isoformat(),
        }
        
        # Extract title - try different methods based on content
        title = MetadataExtractor._extract_title(content)
        if title:
            metadata["title"] = title
        
        # Extract file information
        if file_path and os.path.exists(file_path):
            metadata["file_path"] = file_path
            metadata["file_type"] = file_type or os.path.splitext(file_path)[1][1:]
            metadata["creation_date"] = datetime.fromtimestamp(os.path.getctime(file_path)).isoformat()
            metadata["modification_date"] = datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
            metadata["file_size"] = os.path.getsize(file_path)
        
        # Extract chapter/section information
        chapter_info = MetadataExtractor._extract_chapter_info(content)
        if chapter_info:
            metadata.update(chapter_info)
            
        return metadata
    
    @staticmethod
    def _extract_title(content: str) -> Optional[str]:
        """Extract the main title from document content"""
        if not content:
            return None
            
        # Look for Markdown headers (# Title)
        md_header_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if md_header_match:
            return md_header_match.group(1).strip()
            
        # Look for underlined headers (Title\n====)
        underline_match = re.search(r'^(.+)\n=+\s*$', content, re.MULTILINE)
        if underline_match:
            return underline_match.group(1).strip()
        
        # Look for ALL CAPS titles (common in some documents)
        caps_match = re.search(r'^([A-Z][A-Z\s]+[A-Z])$', content, re.MULTILINE)
        if caps_match:
            return caps_match.group(1).strip()
        
        # Default: use first non-empty line as title
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) < 100:  # Reasonable title length
                return line
                
        return "Unknown Title"
    
    @staticmethod
    def _extract_chapter_info(content: str) -> Dict[str, Any]:
        """Extract chapter and section information from content"""
        chapter_info = {}
        
        # Look for chapter patterns like "Chapter X" or "Section X"
        chapter_match = re.search(r'(?:Chapter|CHAPTER|Chương)\s+(\d+|[IVXLCDM]+)', content)
        if chapter_match:
            chapter_info["chapter"] = chapter_match.group(0)
            
        # Look for section patterns
        section_match = re.search(r'(?:Section|SECTION|Mục|MỤC)\s+(\d+(?:\.\d+)*)', content)
        if section_match:
            chapter_info["section"] = section_match.group(0)
            
        # Look for Vietnamese-specific patterns (like "PHẦN", "BÀI")
        vn_section_match = re.search(r'(?:PHẦN|Phần|BÀI|Bài)\s+(\d+|[IVXLCDM]+)', content)
        if vn_section_match:
            chapter_info["part"] = vn_section_match.group(0)
            
        return chapter_info
    
    @staticmethod
    def enrich_chunk_metadata(chunk_text: str, source_metadata: Dict[str, Any], 
                             chunk_index: int, total_chunks: int) -> Dict[str, Any]:
        """
        Enrich a text chunk with relevant metadata for storage
        
        Args:
            chunk_text: The text content of the chunk
            source_metadata: Metadata from the source document
            chunk_index: Index of this chunk in the document
            total_chunks: Total number of chunks in the document
            
        Returns:
            Dictionary with enriched metadata for the chunk
        """
        chunk_metadata = source_metadata.copy()
        
        # Add chunk-specific metadata
        chunk_metadata.update({
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "chunk_size": len(chunk_text),
            "chunk_preview": chunk_text[:50].replace("\n", " ") + "...",
            "position": f"{chunk_index + 1}/{total_chunks}"
        })
        
        return chunk_metadata
    
    @staticmethod
    def extract_video_metadata(content: Dict[str, Any], video_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract metadata from video content
        
        Args:
            content: Dictionary containing video content data
            video_path: Path to the video file
            
        Returns:
            Dictionary containing extracted metadata
        """
        metadata = {
            "source": os.path.basename(video_path) if video_path else "Unknown Video",
            "extraction_date": datetime.now().isoformat(),
            "content_type": "video"
        }
        
        # Extract video file information
        if video_path and os.path.exists(video_path):
            metadata["file_path"] = video_path
            metadata["file_type"] = os.path.splitext(video_path)[1][1:]
            metadata["creation_date"] = datetime.fromtimestamp(os.path.getctime(video_path)).isoformat()
            metadata["modification_date"] = datetime.fromtimestamp(os.path.getmtime(video_path)).isoformat()
            metadata["file_size"] = os.path.getsize(video_path)
        
        # Extract video-specific metadata
        if "duration" in content:
            metadata["duration"] = content["duration"]
        
        if "title" in content:
            metadata["title"] = content["title"]
        
        if "timestamps" in content:
            metadata["has_timestamps"] = True
        
        if "slides" in content:
            metadata["slide_count"] = len(content["slides"])
        
        return metadata