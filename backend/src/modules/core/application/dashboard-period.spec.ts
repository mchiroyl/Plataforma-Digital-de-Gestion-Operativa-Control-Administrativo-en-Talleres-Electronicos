import { BadRequestException } from '@nestjs/common';
import { CoreService } from './core.service';

describe('Dashboard custom period validation', () => {
  let service: CoreService;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    service = new CoreService({} as never);
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-07T12:00:00.000Z').getTime());
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('rejects custom dates older than 24 months', () => {
    expect(() => (service as any).dashboardPeriod({ period: 'custom', from: '2024-06-06', to: '2026-06-07' })).toThrow(BadRequestException);
  });

  it('rejects custom dates in the future', () => {
    expect(() => (service as any).dashboardPeriod({ period: 'custom', from: '2026-06-07', to: '2026-06-08' })).toThrow(BadRequestException);
  });

  it('rejects custom ranges where from is greater than to', () => {
    expect(() => (service as any).dashboardPeriod({ period: 'custom', from: '2026-06-07', to: '2026-06-01' })).toThrow(BadRequestException);
  });
});
