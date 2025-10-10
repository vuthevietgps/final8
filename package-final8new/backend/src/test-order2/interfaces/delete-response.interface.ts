/**
 * Interface for TestOrder2 delete operation response
 */
export interface DeleteResponse {
  /** Success or error message */
  message: string;
  
  /** Action taken: 'deleted' | 'status_changed' */
  action?: 'deleted' | 'status_changed';
  
  /** Manual payment amount that prevented deletion (if any) */
  manualPayment?: number;
}