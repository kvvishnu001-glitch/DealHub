"""
Compliance Management Service
Ensures all affiliate marketing activities comply with network terms and FTC guidelines
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update

from database import get_db
from models import Deal, ComplianceLog, AffiliateConfig

logger = logging.getLogger(__name__)

class ComplianceManager:
    """Manages compliance across all affiliate networks and FTC requirements"""
    
    def __init__(self):
        self.ftc_requirements = {
            'disclosure_required': True,
            'clear_and_conspicuous': True,
            'close_to_claim': True,
            'plain_language': True
        }
        
        # Network-specific compliance rules
        self.network_rules = {
            'amazon': {
                'price_update_frequency': 24,  # hours
                'required_disclaimers': [
                    "As an Amazon Associate I earn from qualifying purchases",
                    "Prices may change without notice"
                ],
                'prohibited_practices': [
                    'email_marketing',
                    'trademark_bidding'
                ],
                'data_retention_limit': 24  # hours
            },
            'cj': {
                'required_disclaimers': [
                    "This post contains affiliate links"
                ],
                'advertiser_specific_terms': True,
                'data_retention_limit': 720  # 30 days
            },
            'clickbank': {
                'required_disclaimers': [
                    "This post contains affiliate links"
                ],
                'earnings_disclaimer_required': True
            },
            'shareasale': {
                'trademark_restrictions': True,
                'required_disclaimers': [
                    "This post contains affiliate links"
                ]
            }
        }

    async def validate_deal_compliance(self, deal: Dict[str, Any], network_id: str) -> Dict[str, Any]:
        """Comprehensive compliance validation for a deal"""
        
        validation_result = {
            'is_compliant': True,
            'compliance_score': 100,
            'issues': [],
            'warnings': [],
            'required_actions': [],
            'ftc_compliance': {},
            'network_compliance': {}
        }
        
        # FTC Compliance Check
        ftc_result = await self._validate_ftc_compliance(deal)
        validation_result['ftc_compliance'] = ftc_result
        
        if not ftc_result['compliant']:
            validation_result['is_compliant'] = False
            validation_result['issues'].extend(ftc_result['issues'])
        
        # Network-Specific Compliance
        if network_id in self.network_rules:
            network_result = await self._validate_network_compliance(deal, network_id)
            validation_result['network_compliance'] = network_result
            
            if not network_result['compliant']:
                validation_result['is_compliant'] = False
                validation_result['issues'].extend(network_result['issues'])
        
        # Calculate compliance score
        total_issues = len(validation_result['issues'])
        total_warnings = len(validation_result['warnings'])
        validation_result['compliance_score'] = max(0, 100 - (total_issues * 20) - (total_warnings * 5))
        
        # Log compliance check
        await self._log_compliance_check(deal.get('id'), network_id, validation_result)
        
        return validation_result

    async def _validate_ftc_compliance(self, deal: Dict[str, Any]) -> Dict[str, Any]:
        """Validate FTC disclosure requirements"""
        
        result = {
            'compliant': True,
            'issues': [],
            'recommendations': []
        }
        
        # Check for affiliate disclosure indicators
        content_fields = [
            deal.get('title', ''),
            deal.get('description', ''),
            deal.get('additional_content', '')
        ]
        
        content_text = ' '.join(content_fields).lower()
        
        # Look for disclosure keywords
        disclosure_keywords = [
            'affiliate', 'commission', 'sponsored', 'ad', 'partnership',
            'earn from qualifying purchases', 'compensated', 'paid promotion'
        ]
        
        has_disclosure = any(keyword in content_text for keyword in disclosure_keywords)
        
        if deal.get('affiliate_url') and not has_disclosure:
            result['compliant'] = False
            result['issues'].append('Missing required affiliate disclosure')
            result['recommendations'].append('Add clear affiliate disclosure statement')
        
        # Check for misleading claims
        misleading_phrases = [
            'guaranteed', 'risk-free', 'instant wealth', 'get rich quick',
            'no effort required', 'secret system'
        ]
        
        for phrase in misleading_phrases:
            if phrase in content_text:
                result['issues'].append(f'Potentially misleading claim: "{phrase}"')
                result['recommendations'].append('Remove or modify misleading language')
        
        return result

    async def _validate_network_compliance(self, deal: Dict[str, Any], network_id: str) -> Dict[str, Any]:
        """Validate network-specific compliance requirements"""
        
        result = {
            'compliant': True,
            'issues': [],
            'warnings': []
        }
        
        network_rules = self.network_rules.get(network_id, {})
        
        # Check required disclaimers
        required_disclaimers = network_rules.get('required_disclaimers', [])
        content = f"{deal.get('title', '')} {deal.get('description', '')}".lower()
        
        for disclaimer in required_disclaimers:
            if disclaimer.lower() not in content:
                result['warnings'].append(f'Missing recommended disclaimer: "{disclaimer}"')
        
        # Check affiliate URL format
        affiliate_url = deal.get('affiliate_url', '')
        
        if network_id == 'amazon' and affiliate_url:
            if 'tag=' not in affiliate_url or 'amazon.' not in affiliate_url:
                result['issues'].append('Invalid Amazon affiliate URL format')
                result['compliant'] = False
        
        elif network_id == 'clickbank' and affiliate_url:
            if '.hop.clickbank.net' not in affiliate_url:
                result['issues'].append('Invalid ClickBank hoplink format')
                result['compliant'] = False
        
        # Check data freshness (especially for Amazon)
        if network_id == 'amazon':
            deal_age_hours = self._calculate_deal_age_hours(deal)
            max_age = network_rules.get('data_retention_limit', 24)
            
            if deal_age_hours > max_age:
                result['issues'].append(f'Deal data older than {max_age} hours')
                result['compliant'] = False
        
        # Check for prohibited practices
        prohibited = network_rules.get('prohibited_practices', [])
        
        if 'email_marketing' in prohibited:
            result['warnings'].append('Cannot be used in email marketing campaigns')
        
        if 'trademark_bidding' in prohibited:
            result['warnings'].append('Cannot bid on trademark terms in advertising')
        
        return result

    async def _log_compliance_check(self, deal_id: str, network_id: str, validation_result: Dict[str, Any]):
        """Log compliance check results"""
        
        try:
            async with get_db() as db:
                compliance_log = ComplianceLog(
                    deal_id=deal_id,
                    network_id=network_id,
                    compliance_check=validation_result,
                    is_compliant=validation_result['is_compliant'],
                    issues_found=validation_result['issues']
                )
                db.add(compliance_log)
                await db.commit()
        except Exception as e:
            logger.error(f"Error logging compliance check: {e}")

    def _calculate_deal_age_hours(self, deal: Dict[str, Any]) -> float:
        """Calculate how old a deal is in hours"""
        
        try:
            created_at = deal.get('created_at')
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            elif created_at is None:
                return 0
            
            age = datetime.utcnow() - created_at.replace(tzinfo=None)
            return age.total_seconds() / 3600
        except Exception:
            return 0

    async def get_compliance_summary(self, network_id: Optional[str] = None) -> Dict[str, Any]:
        """Get compliance summary for all deals or specific network"""
        
        async with get_db() as db:
            query = select(ComplianceLog)
            if network_id:
                query = query.where(ComplianceLog.network_id == network_id)
            
            # Get recent logs (last 30 days)
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            query = query.where(ComplianceLog.created_at >= thirty_days_ago)
            
            result = await db.execute(query)
            logs = result.scalars().all()
            
            total_checks = len(logs)
            compliant_checks = len([log for log in logs if log.is_compliant])
            
            summary = {
                'total_compliance_checks': total_checks,
                'compliant_deals': compliant_checks,
                'non_compliant_deals': total_checks - compliant_checks,
                'compliance_rate': (compliant_checks / total_checks * 100) if total_checks > 0 else 0,
                'common_issues': self._analyze_common_issues(logs),
                'network_breakdown': self._get_network_breakdown(logs)
            }
            
            return summary

    def _analyze_common_issues(self, logs: List[ComplianceLog]) -> List[Dict[str, Any]]:
        """Analyze most common compliance issues"""
        
        issue_counts = {}
        
        for log in logs:
            if not log.is_compliant and log.issues_found:
                for issue in log.issues_found:
                    issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        # Sort by frequency
        sorted_issues = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)
        
        return [
            {'issue': issue, 'count': count, 'percentage': (count / len(logs) * 100)}
            for issue, count in sorted_issues[:10]  # Top 10
        ]

    def _get_network_breakdown(self, logs: List[ComplianceLog]) -> Dict[str, Dict[str, Any]]:
        """Get compliance breakdown by network"""
        
        network_stats = {}
        
        for log in logs:
            network = log.network_id
            if network not in network_stats:
                network_stats[network] = {
                    'total': 0,
                    'compliant': 0,
                    'non_compliant': 0
                }
            
            network_stats[network]['total'] += 1
            if log.is_compliant:
                network_stats[network]['compliant'] += 1
            else:
                network_stats[network]['non_compliant'] += 1
        
        # Calculate percentages
        for network, stats in network_stats.items():
            total = stats['total']
            stats['compliance_rate'] = (stats['compliant'] / total * 100) if total > 0 else 0
        
        return network_stats

    async def auto_fix_common_issues(self, deal_id: str) -> Dict[str, Any]:
        """Automatically fix common compliance issues where possible"""
        
        fixes_applied = []
        
        async with get_db() as db:
            # Get the deal
            result = await db.execute(select(Deal).where(Deal.id == deal_id))
            deal = result.scalar_one_or_none()
            
            if not deal:
                return {'success': False, 'error': 'Deal not found'}
            
            # Auto-fix missing affiliate disclosure
            description = deal.description or ""
            if deal.affiliate_url and 'affiliate' not in description.lower():
                disclosure = "\n\nNote: This post contains affiliate links. We may earn a commission from qualifying purchases."
                await db.execute(
                    update(Deal)
                    .where(Deal.id == deal_id)
                    .values(description=description + disclosure)
                )
                fixes_applied.append('Added affiliate disclosure')
            
            # Auto-fix Amazon-specific issues
            if deal.source == 'amazon':
                amazon_disclosure = "As an Amazon Associate I earn from qualifying purchases."
                if amazon_disclosure not in description:
                    await db.execute(
                        update(Deal)
                        .where(Deal.id == deal_id)
                        .values(description=description + f"\n\n{amazon_disclosure}")
                    )
                    fixes_applied.append('Added Amazon Associate disclosure')
            
            await db.commit()
        
        return {
            'success': True,
            'fixes_applied': fixes_applied,
            'total_fixes': len(fixes_applied)
        }