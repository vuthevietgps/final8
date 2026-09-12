import { isDealerSale, saleModeForAgentRole } from './order-sale-mode';

describe('order sale relationship', () => {
  it('treats no agent and an internal agent as company retail', () => {
    expect(saleModeForAgentRole(undefined)).toBe('retail');
    expect(saleModeForAgentRole('company-user', 'internal_agent')).toBe('retail');
    expect(isDealerSale({ agentId: 'company-user', saleMode: 'retail', agentRoleSnapshot: 'internal_agent' })).toBe(false);
  });

  it('treats only an external agent as a dealer buyer', () => {
    expect(saleModeForAgentRole('dealer-user', 'external_agent')).toBe('dealer');
    expect(isDealerSale({ agentId: 'dealer-user', saleMode: 'dealer', agentRoleSnapshot: 'external_agent' })).toBe(true);
  });

  it('keeps an unclassified historical agent row conservative until backfill', () => {
    expect(isDealerSale({ agentId: 'legacy-agent' })).toBe(true);
  });
});
