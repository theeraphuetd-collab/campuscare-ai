export type Category='electrical'|'plumbing'|'accessibility'|'cleanliness'|'safety'|'other';
export type IssueStatus='open'|'in_progress'|'resolved';
export interface Issue {
 id:string;title:string;location_id:string|null;location_text:string;category:Category;
 severity:1|2|3|4|5;status:IssueStatus;created_at:string;updated_at:string;
 reports?:{count:number}[];
}
export interface Report {
 id:string;reporter_id:string;client_request_id:string;description:string;transcript:string;
 location_id:string|null;location_text:string;issue_id:string|null;
 processing_status:'pending'|'processing'|'completed'|'failed';created_at:string;
 issues?:Issue|null;
}
export interface Dashboard {
 date:string;report_count:number;backlog_count:number;
 issues:Pick<Issue,'severity'|'status'|'category'>[];
 by_category:Partial<Record<Category,number>>;
 by_location:{location_id:string|null;location_text:string;total:number}[];
}
