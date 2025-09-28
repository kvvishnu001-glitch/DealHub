import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  progress: number;
  error?: string;
  success?: boolean;
}

const AFFILIATE_NETWORKS = [
  { value: 'amazon', label: 'Amazon Associates' },
  { value: 'cj', label: 'Commission Junction (CJ)' },
  { value: 'shareasale', label: 'ShareASale' },
  { value: 'rakuten', label: 'Rakuten Advertising' },
  { value: 'impact', label: 'Impact Radius' },
  { value: 'partnerize', label: 'Partnerize' },
  { value: 'avantlink', label: 'AvantLink' },
  { value: 'awin', label: 'AWIN' },
  { value: 'clickbank', label: 'ClickBank' },
  { value: 'other', label: 'Other Network' }
];

const SUPPORTED_FORMATS = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
  'application/json',
  'text/plain'
];

export function FileUploadModal({ open, onClose, onUploadComplete }: FileUploadModalProps) {
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      progress: 0
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'application/json': ['.json'],
      'text/plain': ['.txt']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: true
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!selectedNetwork || files.length === 0) {
      alert('Please select a network and add at least one file');
      return;
    }

    setUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const fileData = files[i];
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, uploading: true, progress: 0 } : f
        ));

        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('network', selectedNetwork);
        if (description) {
          formData.append('description', description);
        }

        const response = await fetch('/api/admin/upload-deals', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, uploading: false, success: true, progress: 100 } : f
          ));
        } else {
          const error = await response.text();
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, uploading: false, error, progress: 0 } : f
          ));
        }
      }

      // If all successful, close modal and refresh
      const allSuccessful = files.every(f => f.success);
      if (allSuccessful) {
        setTimeout(() => {
          onUploadComplete();
          onClose();
          resetForm();
        }, 1000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedNetwork('');
    setDescription('');
    setFiles([]);
    setUploading(false);
  };

  const downloadSample = async (network: string) => {
    try {
      const response = await fetch(`/api/admin/sample-files/download/${network}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${network}_deals_sample.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  if (!open) return null;

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: "rgba(0,0,0,0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      zIndex: 1000 
    }}>
      <div style={{ 
        backgroundColor: "white", 
        padding: "30px", 
        borderRadius: "8px", 
        width: "90%", 
        maxWidth: "800px", 
        maxHeight: "90vh", 
        overflowY: "auto" 
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, color: "#333" }}>Upload Deal Files</h2>
          <button
            onClick={onClose}
            style={{ 
              background: "none", 
              border: "none", 
              fontSize: "24px", 
              cursor: "pointer", 
              color: "#666" 
            }}
          >
            ×
          </button>
        </div>

        {/* Network Selection */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Affiliate Network *
          </label>
          <select
            value={selectedNetwork}
            onChange={(e) => setSelectedNetwork(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          >
            <option value="">Select Network</option>
            {AFFILIATE_NETWORKS.map(network => (
              <option key={network.value} value={network.value}>
                {network.label}
              </option>
            ))}
          </select>
          
          {selectedNetwork && ['amazon', 'cj', 'shareasale'].includes(selectedNetwork) && (
            <button
              onClick={() => downloadSample(selectedNetwork)}
              style={{
                marginTop: "10px",
                padding: "8px 16px",
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              📥 Download Sample File
            </button>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the deals being uploaded..."
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              minHeight: "80px",
              resize: "vertical"
            }}
          />
        </div>

        {/* File Upload Area */}
        <div 
          {...getRootProps()} 
          style={{
            border: "2px dashed #ccc",
            borderRadius: "8px",
            padding: "40px",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragActive ? "#f8f9fa" : "white",
            marginBottom: "20px"
          }}
        >
          <input {...getInputProps()} />
          <div style={{ fontSize: "48px", marginBottom: "10px" }}>📁</div>
          {isDragActive ? (
            <p>Drop the files here...</p>
          ) : (
            <div>
              <p style={{ fontSize: "16px", marginBottom: "10px" }}>
                Drag & drop deal files here, or click to select
              </p>
              <p style={{ fontSize: "12px", color: "#666" }}>
                Supported formats: CSV, Excel, XML, JSON, TXT (Max 50MB per file)
              </p>
            </div>
          )}
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ marginBottom: "10px" }}>Selected Files:</h4>
            {files.map((file, index) => (
              <div key={index} style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                marginBottom: "10px",
                backgroundColor: file.success ? "#d4edda" : file.error ? "#f8d7da" : "white"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>📄</span>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>{file.file.name}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {file.uploading && (
                    <div style={{ fontSize: "12px", color: "#007bff" }}>Uploading...</div>
                  )}
                  {file.success && (
                    <div style={{ fontSize: "12px", color: "#28a745" }}>✓ Uploaded</div>
                  )}
                  {file.error && (
                    <div style={{ fontSize: "12px", color: "#dc3545" }}>✗ Failed</div>
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#dc3545",
                      cursor: "pointer",
                      fontSize: "16px"
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={uploadFiles}
            disabled={uploading || !selectedNetwork || files.length === 0}
            style={{
              padding: "10px 20px",
              backgroundColor: uploading ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: uploading ? "not-allowed" : "pointer"
            }}
          >
            {uploading ? "Uploading..." : "Upload Files"}
          </button>
        </div>
      </div>
    </div>
  );
}